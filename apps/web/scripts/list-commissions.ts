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
  console.log("Fetching all commission records...");
  
  const commissions = await prisma.commission.findMany({
    select: {
      id: true,
      type: true,
      amount: true,
      earnings: true,
      status: true,
      createdAt: true,
      partnerId: true,
      programId: true,
      linkId: true,
      customerId: true,
      partner: {
        select: {
          name: true,
          email: true
        }
      },
      link: {
        select: {
          shortLink: true,
          url: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log(`Found ${commissions.length} commission records.`);
  
  // Format and display commission details
  commissions.forEach((commission, index) => {
    console.log(`\n--- Commission ${index + 1} ---`);
    console.log(`ID: ${commission.id}`);
    console.log(`Type: ${commission.type}`);
    console.log(`Amount: ${(commission.amount / 100).toFixed(2)}`);
    console.log(`Earnings: ${(commission.earnings / 100).toFixed(2)}`);
    console.log(`Status: ${commission.status}`);
    console.log(`Created: ${commission.createdAt.toISOString()}`);
    console.log(`Partner: ${commission.partner?.name || 'Unknown'} (${commission.partnerId})`);
    console.log(`Program ID: ${commission.programId}`);
    console.log(`Link: ${commission.link?.shortLink || 'N/A'} (${commission.linkId})`);
    console.log(`Link URL: ${commission.link?.url || 'N/A'}`);
    console.log(`Customer ID: ${commission.customerId || 'N/A'}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 