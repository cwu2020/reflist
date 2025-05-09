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
import { emitEvent } from "../events/emitter";
import { EventType, UserCreatedEvent } from "../events/types";
import { registerEventHandlers } from "../events/register-handlers";

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
            ...(phoneNumber && { phoneNumber: phoneNumber }),
          },
        });
        
        // Update user with defaultPartnerId
        await tx.user.update({
          where: { id: newUser.id },
          data: { defaultPartnerId: partner.id },
        });

        // If user is claiming commissions, emit a USER_CREATED event
        if (claim && phoneNumber) {
          // Register event handlers to ensure they're set up
          registerEventHandlers();
          
          // Emit USER_CREATED event for asynchronous commission claiming
          emitEvent(EventType.USER_CREATED, {
            userId: newUser.id,
            email: email,
            phoneNumber: phoneNumber
          } as Omit<UserCreatedEvent, 'type' | 'timestamp'>);
          
          console.log(`Emitted USER_CREATED event for new user ${newUser.id} with phone ${phoneNumber}`);
        }
      });
    }
  });

// DEPRECATED: This function is replaced by CommissionClaimService
// Helper function to claim unclaimed commissions
// This is only kept for reference and will be removed in future updates
// Use commissionClaimService.claimCommissions() instead
/* 
async function claimUnclaimedCommissions(tx: any, phoneNumber: string, partnerId: string) {
  console.log(`Starting commission claiming process for phone: ${phoneNumber}, partnerId: ${partnerId}`);
  
  // Find all unclaimed commission splits associated with this phone number
  const commissionSplits = await tx.commissionSplit.findMany({
    where: {
      phoneNumber: phoneNumber,
      claimed: false,
    },
    include: {
      commission: {
        include: {
          program: true,
        }
      }
    },
  });
  
  console.log(`Found ${commissionSplits.length} unclaimed commission splits`);

  // Also check for legacy format with splitRecipientPhone field
  const legacyCommissions = await tx.commission.findMany({
    where: {
      splitRecipientPhone: phoneNumber,
      splitClaimed: false,
    },
    include: {
      program: true,
    },
  });

  if (commissionSplits.length === 0 && legacyCommissions.length === 0) {
    return;
  }

  // Process commission splits first
  for (const split of commissionSplits) {
    if (split.commission) {
      // Create a new commission for the new partner
      await tx.commission.create({
        data: {
          id: createId({ prefix: "cm_" }),
          programId: split.commission.programId,
          partnerId: partnerId,
          customerId: split.commission.customerId,
          linkId: split.commission.linkId,
          eventId: `${split.commission.eventId}_claimed_by_${partnerId}`,
          invoiceId: split.commission.invoiceId,
          quantity: split.commission.quantity,
          amount: split.commission.amount,
          type: split.commission.type,
          currency: split.commission.currency,
          earnings: split.earnings || 0,
          note: `Claimed from commission split via phone verification (${phoneNumber})`,
        },
      });

      // Mark the split as claimed
      try {
        console.log(`Attempting to update commission split ${split.id} to claimed status for partner ${partnerId}`);
        await tx.commissionSplit.update({
          where: { id: split.id },
          data: {
            claimed: true,
            claimedAt: new Date(),
            claimedById: partnerId,
          },
        });
        console.log(`Successfully updated commission split ${split.id} to claimed status`);
      } catch (error) {
        console.error(`Error updating commission split ${split.id}:`, error);
      }
    }
  }

  // Process legacy commissions
  for (const commission of legacyCommissions) {
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
        note: `Claimed from legacy split via phone verification (${phoneNumber})`,
      },
    });

    // Mark the original commission as claimed
    try {
      console.log(`Attempting to update legacy commission ${commission.id} to claimed status for partner ${partnerId}`);
      await tx.commission.update({
        where: { id: commission.id },
        data: {
          splitClaimed: true,
          splitClaimedAt: new Date(),
          splitClaimedById: partnerId,
        },
      });
      console.log(`Successfully updated legacy commission ${commission.id} to claimed status`);
    } catch (error) {
      console.error(`Error updating legacy commission ${commission.id}:`, error);
    }
  }

  // Verify all splits were properly claimed by checking for any remaining unclaimed splits
  const remainingUnclaimedSplits = await tx.commissionSplit.findMany({
    where: {
      phoneNumber: phoneNumber,
      claimed: false,
    },
  });
  
  console.log(`After claiming process, found ${remainingUnclaimedSplits.length} remaining unclaimed splits`);
  
  if (remainingUnclaimedSplits.length > 0) {
    console.log(`WARNING: Not all commission splits were claimed. IDs: ${remainingUnclaimedSplits.map(s => s.id).join(', ')}`);
  }
  
  console.log(`Commission claiming process completed for ${phoneNumber}`);
}
*/
