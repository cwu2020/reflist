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
  console.log("Checking for commissions with null partnerId...");
  
  // Direct count query to avoid type issues
  const count = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count FROM Commission WHERE partnerId IS NULL
  `;
  
  console.log(`Found ${count[0].count} commissions with null partnerId`);
  
  // Check if there are any commissions with invalid partnerId references
  const invalidPartnerCount = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count 
    FROM Commission c
    LEFT JOIN Partner p ON c.partnerId = p.id
    WHERE p.id IS NULL
  `;
  
  console.log(`Found ${invalidPartnerCount[0].count} commissions with invalid partner references`);
  
  if (count[0].count > 0 || invalidPartnerCount[0].count > 0) {
    // If we found any problematic records, get some examples
    const examples = await prisma.$queryRaw<any[]>`
      SELECT c.id, c.partnerId, c.linkId 
      FROM Commission c
      LEFT JOIN Partner p ON c.partnerId = p.id
      WHERE p.id IS NULL
      LIMIT 5
    `;
    
    console.log("Example problematic commission records:");
    console.log(examples);
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