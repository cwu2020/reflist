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
 * This script applies the commission split migration for production without foreign key constraints
 * It applies only the necessary column changes using prisma.$executeRaw
 */
async function main() {
  console.log("🚀 Starting commission split migration for production");

  try {
    // Start a transaction - doing individual queries without transaction since PlanetScale
    // might have limitations for larger transactions
    console.log("Step 1: Checking if claimedByPartnerId column already exists");
    
    // Check if the column already exists to avoid errors
    const checkColumnSQL = Prisma.sql`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CommissionSplit' 
      AND COLUMN_NAME = 'claimedByPartnerId'
    `;
    
    const columnCheck = await prisma.$queryRaw(checkColumnSQL);
    const columnExists = (columnCheck as any)[0].count > 0;
    
    if (columnExists) {
      console.log("Column claimedByPartnerId already exists, skipping rename step");
    } else {
      console.log("Step 2: Renaming claimedById to claimedByPartnerId");
      
      // Rename the original column
      await prisma.$executeRaw`
        ALTER TABLE CommissionSplit 
        RENAME COLUMN claimedById TO claimedByPartnerId
      `;
      console.log("Column renamed successfully");
    }
    
    console.log("Step 3: Checking if claimedByUserId column already exists");
    
    // Check if the new column already exists
    const checkNewColumnSQL = Prisma.sql`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CommissionSplit' 
      AND COLUMN_NAME = 'claimedByUserId'
    `;
    
    const newColumnCheck = await prisma.$queryRaw(checkNewColumnSQL);
    const newColumnExists = (newColumnCheck as any)[0].count > 0;
    
    if (newColumnExists) {
      console.log("Column claimedByUserId already exists, skipping add column step");
    } else {
      console.log("Step 4: Adding claimedByUserId column");
      
      // Add the new column
      await prisma.$executeRaw`
        ALTER TABLE CommissionSplit 
        ADD COLUMN claimedByUserId VARCHAR(191) NULL
      `;
      console.log("Column added successfully");
    }
    
    console.log("✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("Error applying migration:", error);
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