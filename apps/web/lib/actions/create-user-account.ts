"use server";

import { ratelimit } from "@/lib/upstash";
import { prisma } from "@dub/prisma";
import { flattenValidationErrors } from "next-safe-action";
import { createId } from "../api/create-id";
import { getIP } from "../api/utils";
import { hashPassword } from "../auth/password";
import z from "../zod";
import { signUpSchema } from "../zod/schemas/auth";
import { throwIfAuthenticated } from "./auth/throw-if-authenticated";
import { actionClient } from "./safe-action";

const schema = signUpSchema.extend({
  code: z.string().min(6, "OTP must be 6 characters long."),
  phoneNumber: z.string().optional(), // Optional phone number for claiming commission
  claim: z.boolean().optional(), // Flag to indicate if user is claiming commissions
});

// Sign up a new user using email and password
export const createUserAccountAction = actionClient
  .schema(schema, {
    handleValidationErrorsShape: (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  .use(throwIfAuthenticated)
  .action(async ({ parsedInput }) => {
    const { email, password, code, phoneNumber, claim } = parsedInput;

    const { success } = await ratelimit(2, "1 m").limit(`signup:${getIP()}`);

    if (!success) {
      throw new Error("Too many requests. Please try again later.");
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        identifier: email,
        token: code,
        expires: {
          gte: new Date(),
        },
      },
    });

    if (!verificationToken) {
      throw new Error("Invalid verification code entered.");
    }

    await prisma.emailVerificationToken.delete({
      where: {
        identifier: email,
        token: code,
      },
    });

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      // Create user and corresponding partner record in a transaction
      const userId = createId({ prefix: "user_" });
      
      await prisma.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            id: userId,
            email,
            passwordHash: await hashPassword(password),
            emailVerified: new Date(),
          },
        });
        
        // Create partner record
        const partnerId = createId({ prefix: "pn_" });
        const partner = await tx.partner.create({
          data: {
            id: partnerId,
            name: email.split('@')[0], // Default name from email
            email,
            // Add partner-user relationship
            users: {
              create: {
                userId: newUser.id,
                role: 'owner', // Set user as partner owner
              },
            },
            // If phone number is provided, save it to partner
            ...(phoneNumber && { phone: phoneNumber }),
          },
        });
        
        // Update user with defaultPartnerId
        await tx.user.update({
          where: { id: newUser.id },
          data: { defaultPartnerId: partner.id },
        });

        // If user is claiming commissions, process unclaimed commissions
        if (claim && phoneNumber) {
          await claimUnclaimedCommissions(tx, phoneNumber, partnerId);
        }
      });
    }
  });

// Helper function to claim unclaimed commissions
async function claimUnclaimedCommissions(tx: any, phoneNumber: string, partnerId: string) {
  // Find all unclaimed commissions associated with this phone number
  const unclaimedCommissions = await tx.commission.findMany({
    where: {
      splitRecipientPhone: phoneNumber,
      splitClaimed: false,
    },
    include: {
      program: true,
    },
  });

  if (unclaimedCommissions.length === 0) {
    return;
  }

  // For each unclaimed commission, create a new commission for the new partner
  for (const commission of unclaimedCommissions) {
    // Create a new commission for the new partner
    await tx.commission.create({
      data: {
        id: createId({ prefix: "cm_" }),
        programId: commission.programId,
        partnerId: partnerId,
        customerId: commission.customerId,
        linkId: commission.linkId,
        eventId: `${commission.eventId}_claimed_by_${partnerId}`,
        invoiceId: commission.invoiceId,
        quantity: commission.quantity,
        amount: commission.amount,
        type: commission.type,
        currency: commission.currency,
        earnings: commission.splitAmount || 0,
        note: `Claimed from split via phone verification (${phoneNumber})`,
      },
    });

    // Mark the original commission as claimed
    await tx.commission.update({
      where: { id: commission.id },
      data: {
        splitClaimed: true,
        splitClaimedAt: new Date(),
        splitClaimedById: partnerId,
      },
    });
  }
}
