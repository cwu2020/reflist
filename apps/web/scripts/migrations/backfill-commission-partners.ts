import { prisma } from "@dub/prisma";
import { createId } from "@/lib/api/create-id";
import { Prisma } from "@dub/prisma/client";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from .env.local file
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`No .env.local file found at ${envPath}`);
  dotenv.config();
}

/**
 * This script backfills partner records for existing commissions that have null or invalid partnerId values
 * The algorithm:
 * 1. Find all commissions with null partnerId or invalid partner references
 * 2. For each commission, get the link and the link's user
 * 3. Check if the user has a partner record, if not create one
 * 4. Associate the commission with the user's partner record
 */
async function main() {
  console.log("🚀 Starting commission partner backfill migration");

  // Step 1: Find all commissions that need to be fixed
  // Look for both NULL partnerId and empty string partnerId
  const rawQuery = Prisma.sql`
    SELECT c.id, c.linkId, l.userId 
    FROM Commission c
    JOIN Link l ON c.linkId = l.id
    LEFT JOIN Partner p ON c.partnerId = p.id
    WHERE c.partnerId IS NULL OR c.partnerId = '' OR p.id IS NULL
  `;

  const commissions = await prisma.$queryRaw<{
    id: string;
    linkId: string;
    userId: string | null;
  }[]>(rawQuery);

  console.log(`Found ${commissions.length} commissions with missing or invalid partner references`);

  // Step 2: Process each commission
  for (const commission of commissions) {
    try {
      if (!commission.userId) {
        console.log(`Commission ${commission.id} has no associated user, skipping`);
        continue;
      }

      console.log(`Processing commission ${commission.id} for user ${commission.userId}`);

      // Step 3: Find or create a partner for the user
      const user = await prisma.user.findUnique({
        where: { id: commission.userId },
      });

      if (!user) {
        console.log(`User ${commission.userId} does not exist, skipping`);
        continue;
      }

      let partnerId = user.defaultPartnerId;
      
      // If user doesn't have a defaultPartnerId, check if they have any partners
      if (!partnerId) {
        const existingPartnerUser = await prisma.partnerUser.findFirst({
          where: { userId: user.id },
          select: { partnerId: true },
        });

        if (existingPartnerUser) {
          partnerId = existingPartnerUser.partnerId;
          
          // Update the user's defaultPartnerId if not set
          await prisma.user.update({
            where: { id: user.id },
            data: { defaultPartnerId: partnerId },
          });
        }
      }

      // If still no partner, create a new one for the user
      if (!partnerId) {
        console.log(`Creating new partner for user ${user.id}`);
        
        const partner = await prisma.partner.create({
          data: {
            id: createId({ prefix: "pn_" }),
            name: user.name || "Unknown User",
            email: user.email || undefined,
            users: {
              create: {
                userId: user.id,
                role: "owner",
              },
            },
          },
        });
        
        partnerId = partner.id;
        
        // Update the user's defaultPartnerId
        await prisma.user.update({
          where: { id: user.id },
          data: { defaultPartnerId: partnerId },
        });
        
        console.log(`Created partner ${partnerId} for user ${user.id}`);
      }

      // Step 4: Update the commission with the partnerId
      await prisma.$executeRaw`
        UPDATE Commission
        SET partnerId = ${partnerId}
        WHERE id = ${commission.id}
      `;
      
      console.log(`Updated commission ${commission.id} with partnerId ${partnerId}`);
    } catch (error) {
      console.error(`Error processing commission ${commission.id}:`, error);
    }
  }

  console.log("✅ Commission partner backfill migration completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 