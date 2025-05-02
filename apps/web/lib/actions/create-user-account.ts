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
});

// Sign up a new user using email and password
export const createUserAccountAction = actionClient
  .schema(schema, {
    handleValidationErrorsShape: (ve) =>
      flattenValidationErrors(ve).fieldErrors,
  })
  .use(throwIfAuthenticated)
  .action(async ({ parsedInput }) => {
    const { email, password, code } = parsedInput;

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
          },
        });
        
        // Update user with defaultPartnerId
        await tx.user.update({
          where: { id: newUser.id },
          data: { defaultPartnerId: partner.id },
        });
      });
    }
  });
