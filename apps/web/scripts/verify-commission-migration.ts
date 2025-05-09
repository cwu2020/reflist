import { prisma } from "@dub/prisma";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Prisma } from "@dub/prisma/client";

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
 * This script verifies that the commission split migration was successful 
 * by checking the database schema for the new columns and constraints
 */
async function main() {
  console.log("🔍 Verifying commission split migration");

  try {
    // Check for the renamed column
    const checkRenamedColumnSQL = Prisma.sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CommissionSplit' 
      AND COLUMN_NAME = 'claimedByPartnerId'
    `;
    
    const renamedColumnResult = await prisma.$queryRaw(checkRenamedColumnSQL);
    console.log("\nclaimedByPartnerId column:", renamedColumnResult);
    
    // Check for the new column
    const checkNewColumnSQL = Prisma.sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CommissionSplit' 
      AND COLUMN_NAME = 'claimedByUserId'
    `;
    
    const newColumnResult = await prisma.$queryRaw(checkNewColumnSQL);
    console.log("\nclaimedByUserId column:", newColumnResult);
    
    // Check for the foreign key constraint
    const checkForeignKeySQL = Prisma.sql`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'CommissionSplit'
      AND COLUMN_NAME = 'claimedByUserId'
      AND CONSTRAINT_NAME = 'CommissionSplit_claimedByUserId_fkey'
    `;
    
    const foreignKeyResult = await prisma.$queryRaw(checkForeignKeySQL);
    console.log("\nForeign key constraint:", foreignKeyResult);
    
    // Check for the index
    const checkIndexSQL = Prisma.sql`
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_NAME = 'CommissionSplit'
      AND COLUMN_NAME = 'claimedByUserId'
      AND INDEX_NAME = 'CommissionSplit_claimedByUserId_idx'
    `;
    
    const indexResult = await prisma.$queryRaw(checkIndexSQL);
    console.log("\nIndex on claimedByUserId:", indexResult);
    
    // Check if it's all there
    const success = 
      Array.isArray(renamedColumnResult) && (renamedColumnResult as any[]).length > 0 &&
      Array.isArray(newColumnResult) && (newColumnResult as any[]).length > 0 &&
      Array.isArray(foreignKeyResult) && (foreignKeyResult as any[]).length > 0 &&
      Array.isArray(indexResult) && (indexResult as any[]).length > 0;
    
    if (success) {
      console.log("\n✅ Migration verification successful! All expected schema changes are present.");
    } else {
      console.log("\n❌ Migration verification failed. Some expected schema changes are missing.");
    }
    
  } catch (error) {
    console.error("Error verifying migration:", error);
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