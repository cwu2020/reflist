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

async function main() {
  console.log("Starting deletion of ALL commissions...");
  
  // Get total count before deletion
  const totalCommissions = await prisma.commission.count();
  console.log(`Found ${totalCommissions} commissions to delete.`);
  
  if (totalCommissions === 0) {
    console.log("No commissions found to delete.");
    return;
  }
  
  // Check for CommissionSplit model
  const splitCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM CommissionSplit`;
  console.log(`Found ${(splitCount as any)[0]?.count || 0} commission splits.`);
  
  // Delete all commission splits if the model exists
  try {
    console.log("Deleting commission splits...");
    await prisma.$executeRaw`DELETE FROM CommissionSplit`;
    console.log("Commission splits deleted.");
  } catch (error) {
    console.log("No CommissionSplit table found or error deleting splits:", error);
  }
  
  // Delete all commissions
  console.log("Deleting commissions...");
  const deletedCommissions = await prisma.commission.deleteMany({});
  console.log(`Deleted ${deletedCommissions.count} commissions.`);
  
  // Reset link sales statistics
  console.log("Resetting link sales statistics...");
  const updatedLinks = await prisma.link.updateMany({
    where: {
      OR: [
        { sales: { gt: 0 } },
        { saleAmount: { gt: 0 } }
      ]
    },
    data: {
      sales: 0,
      saleAmount: 0
    }
  });
  console.log(`Reset sales statistics for ${updatedLinks.count} links.`);
  
  // Option: Delete orphaned customers that have no commissions
  // Uncomment if you want to delete customers as well
  /*
  console.log("Deleting orphaned customers...");
  const deletedCustomers = await prisma.customer.deleteMany({});
  console.log(`Deleted ${deletedCustomers.count} customers.`);
  */
  
  // Verify deletion
  const remainingCommissions = await prisma.commission.count();
  if (remainingCommissions > 0) {
    console.log(`Warning: ${remainingCommissions} commissions remain in the database.`);
  } else {
    console.log("All commissions were successfully deleted.");
  }
  
  console.log("Commission deletion and cleanup completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 