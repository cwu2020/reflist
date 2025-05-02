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
  console.log("🔍 Verifying partner model migration...");
  
  // Check for commissions with null or invalid partnerId
  const invalidCommissions = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count 
    FROM Commission c
    LEFT JOIN Partner p ON c.partnerId = p.id
    WHERE c.partnerId IS NULL OR c.partnerId = '' OR p.id IS NULL
  `;
  
  // Ensure we're dealing with a number by explicitly converting
  const invalidCommissionsCount = Number(invalidCommissions[0].count);
  console.log(`Commissions with invalid partner references: ${invalidCommissionsCount}`);
  
  // Check for users without defaultPartnerId
  const usersWithoutPartner = await prisma.user.count({
    where: {
      defaultPartnerId: null,
      isMachine: false // Exclude machine users which may not need partners
    }
  });
  
  console.log(`Users without default partner: ${usersWithoutPartner}`);
  
  // Check for links without partnerId
  const linksWithoutPartner = await prisma.link.count({
    where: {
      partnerId: null,
      userId: {
        not: null // Only check links that have a user
      }
    }
  });
  
  console.log(`Links without partner: ${linksWithoutPartner}`);
  
  // Count total partner records
  const partnerCount = await prisma.partner.count();
  console.log(`Total partner records: ${partnerCount}`);
  
  // Count total program records
  const programCount = await prisma.program.count();
  console.log(`Total program records: ${programCount}`);
  
  // Count total program enrollments
  const enrollmentCount = await prisma.programEnrollment.count();
  console.log(`Total program enrollments: ${enrollmentCount}`);
  
  // Debug the verification logic
  console.log("DEBUG: Verification conditions:");
  console.log(`- invalidCommissionsCount (${typeof invalidCommissionsCount}): ${invalidCommissionsCount}`);
  console.log(`- invalidCommissionsCount === 0: ${invalidCommissionsCount === 0}`);
  console.log(`- linksWithoutPartner === 0: ${linksWithoutPartner === 0}`);
  
  // Success if all required relationships are established
  const hasValidPartnerRelationships = (
    invalidCommissionsCount === 0 && 
    linksWithoutPartner === 0
  );
  
  console.log(`- Combined check (hasValidPartnerRelationships): ${hasValidPartnerRelationships}`);
  
  if (hasValidPartnerRelationships) {
    console.log("✅ Migration verification PASSED! All records have proper partner relationships.");
    if (usersWithoutPartner > 0) {
      console.log(`Note: There are ${usersWithoutPartner} users without default partners, but this may be expected for system or special user accounts.`);
    }
  } else {
    console.log("⚠️ Migration verification FAILED! Some records are missing partner relationships.");
    console.log("Please review the counts above and fix any remaining issues.");
  }
  
  console.log("\nSummarizing migration stats:");
  console.log(`- ${partnerCount} total partner records`);
  console.log(`- ${programCount} total program records`);
  console.log(`- ${enrollmentCount} total program enrollments`);
  console.log(`- ${invalidCommissionsCount} commissions with invalid partner references`);
  console.log(`- ${linksWithoutPartner} links without partner references`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 