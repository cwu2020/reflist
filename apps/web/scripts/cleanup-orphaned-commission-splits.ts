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
 * This script identifies and cleans up orphaned CommissionSplit records
 * where the referenced commission no longer exists.
 */
async function main() {
  console.log("Starting orphaned CommissionSplit cleanup...");
  
  // Define the type for our commission splits to help TypeScript
  type CommissionSplitRecord = {
    id: string;
    commissionId: string;
    phoneNumber: string | null;
    partnerId: string | null;
    earnings: number;
    createdAt: Date;
  };
  
  // Step 1: Get all CommissionSplit records and their commissionIds
  const allSplits = await (prisma as any).commissionSplit.findMany({
    select: {
      id: true,
      commissionId: true,
      phoneNumber: true,
      partnerId: true,
      earnings: true,
      createdAt: true,
    }
  }) as CommissionSplitRecord[];
  
  console.log(`Found ${allSplits.length} total CommissionSplit records`);
  
  // Step 2: Get all unique Commission IDs referenced by splits
  const commissionIds: string[] = [...new Set(allSplits.map(split => split.commissionId))];
  console.log(`Those splits reference ${commissionIds.length} unique commission IDs`);
  
  // Step 3: Check which commission IDs actually exist
  const existingCommissions = await prisma.commission.findMany({
    where: {
      id: {
        in: commissionIds
      }
    },
    select: {
      id: true
    }
  });
  
  const existingCommissionIds = new Set(existingCommissions.map(c => c.id));
  console.log(`Found ${existingCommissionIds.size} existing commission records`);
  
  // Step 4: Find orphaned splits (where commission no longer exists)
  const orphanedSplits = allSplits.filter(split => !existingCommissionIds.has(split.commissionId));
  console.log(`Found ${orphanedSplits.length} orphaned CommissionSplit records`);
  
  if (orphanedSplits.length === 0) {
    console.log("No cleanup needed. All CommissionSplit records have valid Commission references.");
    return;
  }
  
  // Log details of orphaned splits for reference
  console.log("\nOrphaned CommissionSplit records:");
  orphanedSplits.forEach((split, index) => {
    console.log(`${index + 1}. ID: ${split.id}, Commission ID: ${split.commissionId}, Phone: ${split.phoneNumber || 'N/A'}, Partner: ${split.partnerId || 'N/A'}, Earnings: ${split.earnings}, Created: ${split.createdAt}`);
  });
  
  // Step 5: Delete orphaned splits
  const orphanedSplitIds = orphanedSplits.map(split => split.id);
  
  // Ask for confirmation before deleting
  const args = process.argv.slice(2);
  const confirmDelete = args.includes('--confirm');
  
  if (!confirmDelete) {
    console.log("\n⚠️ This is a dry run. No records will be deleted.");
    console.log(`To actually delete the ${orphanedSplits.length} orphaned records, run the script with the --confirm flag:`);
    console.log("npx ts-node scripts/cleanup-orphaned-commission-splits.ts --confirm");
    return;
  }
  
  // Perform the deletion
  const deleteResult = await (prisma as any).commissionSplit.deleteMany({
    where: {
      id: {
        in: orphanedSplitIds
      }
    }
  });
  
  console.log(`\n✅ Successfully deleted ${deleteResult.count} orphaned CommissionSplit records.`);
}

main()
  .catch((e) => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 