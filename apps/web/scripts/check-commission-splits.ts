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
 * This script checks the current state of commission splits
 * to verify their claimed status
 */
async function main() {
  console.log("📊 Checking commission splits status");

  try {
    // Get count of claimed and unclaimed splits
    const claimedCount = await (prisma as any).commissionSplit.count({
      where: {
        claimed: true
      }
    });

    const unclaimedCount = await (prisma as any).commissionSplit.count({
      where: {
        claimed: false
      }
    });

    const totalCount = claimedCount + unclaimedCount;

    console.log(`Total commission splits: ${totalCount}`);
    console.log(`- Claimed: ${claimedCount} (${((claimedCount / totalCount) * 100).toFixed(2)}%)`);
    console.log(`- Unclaimed: ${unclaimedCount} (${((unclaimedCount / totalCount) * 100).toFixed(2)}%)`);

    // Get some sample unclaimed splits if they exist
    if (unclaimedCount > 0) {
      const unclaimedSamples = await (prisma as any).commissionSplit.findMany({
        where: {
          claimed: false
        },
        select: {
          id: true,
          phoneNumber: true,
          earnings: true,
          commission: {
            select: {
              id: true,
              earnings: true
            }
          }
        },
        take: 3
      });

      console.log("\nSample unclaimed splits:");
      unclaimedSamples.forEach((split, i) => {
        console.log(`${i+1}. ID: ${split.id}, Phone: ${split.phoneNumber || 'N/A'}, Earnings: ${split.earnings}, Commission ID: ${split.commission.id}`);
      });
    }
  } catch (error) {
    console.error("Error checking commission splits:", error);
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