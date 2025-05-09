import { prisma } from "@dub/prisma";
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
 * This script resets claimed commission splits to unclaimed status
 * and removes associated partner relationships
 */
async function main() {
  console.log("🔄 Starting commission split reset");

  try {
    // Get claimed commission splits with their associated data
    const claimedSplits = await (prisma as any).commissionSplit.findMany({
      where: {
        claimed: true
      },
      select: {
        id: true,
        phoneNumber: true,
        claimedByUserId: true,
        claimedByPartnerId: true,
        partnerId: true
      }
    });

    console.log(`Found ${claimedSplits.length} claimed commission splits to reset`);

    if (claimedSplits.length === 0) {
      console.log("No claimed commission splits found, nothing to do.");
      return;
    }

    // Extract unique combinations of users, partners, and phone numbers
    const uniquePartnerIds = new Set<string>();
    const userPartnerPairs: {userId: string, partnerId: string}[] = [];

    claimedSplits.forEach(split => {
      if (split.partnerId) {
        uniquePartnerIds.add(split.partnerId);
      }
      if (split.claimedByPartnerId) {
        uniquePartnerIds.add(split.claimedByPartnerId);
      }
      
      if (split.claimedByUserId && split.claimedByPartnerId) {
        userPartnerPairs.push({
          userId: split.claimedByUserId,
          partnerId: split.claimedByPartnerId
        });
      }
      if (split.claimedByUserId && split.partnerId && split.partnerId !== split.claimedByPartnerId) {
        userPartnerPairs.push({
          userId: split.claimedByUserId,
          partnerId: split.partnerId
        });
      }
    });

    console.log(`Found ${uniquePartnerIds.size} unique partners and ${userPartnerPairs.length} user-partner relationships to process`);

    // Find users who have these partners as their default
    const usersToReset = await prisma.user.findMany({
      where: {
        defaultPartnerId: {
          in: Array.from(uniquePartnerIds)
        }
      },
      select: {
        id: true,
        defaultPartnerId: true
      }
    });

    console.log(`Found ${usersToReset.length} users with relevant default partners to reset`);

    // Perform all operations in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Reset commission splits to unclaimed
      const splitResult = await (tx as any).commissionSplit.updateMany({
        where: {
          claimed: true
        },
        data: {
          claimed: false,
          claimedAt: null,
          claimedByUserId: null,
          claimedByPartnerId: null,
          partnerId: null
        }
      });
      
      console.log(`✅ Reset ${splitResult.count} commission splits to unclaimed status`);
      
      // 2. Delete specific partner-user associations for partners from claimed commissions
      if (userPartnerPairs.length > 0) {
        // Create OR conditions for each user-partner pair
        const deleteConditions = userPartnerPairs.map(pair => ({
          userId: pair.userId,
          partnerId: pair.partnerId
        }));
        
        const partnerUserResult = await tx.partnerUser.deleteMany({
          where: {
            OR: deleteConditions
          }
        });
        
        console.log(`✅ Removed ${partnerUserResult.count} specific partner-user associations`);
      }
      
      // 3. Reset default partner only for users whose default partner was associated with claimed commissions
      if (usersToReset.length > 0) {
        const userUpdatePromises = usersToReset.map(user => {
          return tx.user.update({
            where: { id: user.id },
            data: { defaultPartnerId: null }
          });
        });
        
        await Promise.all(userUpdatePromises);
        console.log(`✅ Removed specific default partner associations from ${usersToReset.length} users`);
      }
    });
    
    console.log("✅ Commission split reset completed successfully!");
  } catch (error) {
    console.error("Error resetting commission splits:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 