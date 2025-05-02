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
  console.log("Starting commission deletion...");
  
  // The IDs of the commissions to be deleted
  const commissionIds = [
    'cm_1ovOZoJYWHdUM33Mc5mT',
    'cm_gUmewxNXV8UHCytilS5D'
  ];
  
  // First, let's collect relevant information about these commissions
  const commissions = await prisma.commission.findMany({
    where: {
      id: {
        in: commissionIds
      }
    },
    select: {
      id: true,
      customerId: true,
      partnerId: true,
      linkId: true,
      programId: true
    }
  });
  
  console.log(`Found ${commissions.length} out of ${commissionIds.length} requested commissions.`);
  
  // Collect customer IDs to check if we need to clean them up later
  const customerIds = commissions.map(c => c.customerId).filter(Boolean) as string[];
  
  // Perform the deletion
  const deleteResult = await prisma.commission.deleteMany({
    where: {
      id: {
        in: commissionIds
      }
    }
  });
  
  console.log(`Deleted ${deleteResult.count} commission records.`);
  
  // Now check if any customers should be cleaned up (customers with no remaining commissions)
  if (customerIds.length > 0) {
    // For each customer, check if they have any remaining commissions
    for (const customerId of customerIds) {
      const remainingCommissions = await prisma.commission.count({
        where: {
          customerId
        }
      });
      
      if (remainingCommissions === 0) {
        // This customer has no more commissions, we can safely delete it
        await prisma.customer.delete({
          where: {
            id: customerId
          }
        });
        console.log(`Deleted orphaned customer: ${customerId}`);
      } else {
        console.log(`Customer ${customerId} has ${remainingCommissions} remaining commissions, preserving record.`);
      }
    }
  }
  
  // Let's verify the deletions
  const remainingCommissions = await prisma.commission.findMany({
    where: {
      id: {
        in: commissionIds
      }
    }
  });
  
  if (remainingCommissions.length > 0) {
    console.log(`Warning: ${remainingCommissions.length} commissions were not deleted.`);
    console.log(remainingCommissions.map(c => c.id));
  } else {
    console.log(`All specified commissions were successfully deleted.`);
  }
  
  // Ensure link statistics are updated
  for (const commission of commissions) {
    if (commission.linkId) {
      const linkId = commission.linkId;
      console.log(`Updating statistics for link: ${linkId}`);
      
      // Recalculate sales count and amount for the link
      const salesStats = await prisma.commission.aggregate({
        where: {
          linkId,
          type: 'sale'
        },
        _count: true,
        _sum: {
          amount: true
        }
      });
      
      // Update the link with the new statistics
      await prisma.link.update({
        where: {
          id: linkId
        },
        data: {
          sales: salesStats._count,
          saleAmount: salesStats._sum.amount || 0
        }
      });
      
      console.log(`Updated link statistics: sales=${salesStats._count}, saleAmount=${salesStats._sum.amount || 0}`);
    }
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