#!/usr/bin/env node

/**
 * This script checks if the Prisma schema is in sync with the database
 * It can be run locally to detect schema drift before deploying
 * 
 * Usage:
 *   node scripts/check-schema-sync.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define paths
const prismaDir = path.join(__dirname, '..', 'packages', 'prisma');
const schemaPath = path.join(prismaDir, 'schema');
const introspectionOutputPath = path.join(prismaDir, 'introspection.prisma');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Main function
async function checkSchemaSync() {
  try {
    log('🔍 Checking Prisma schema synchronization...', colors.cyan);
    
    // Step 1: Introspect the database to get its current schema
    log('📊 Introspecting database...', colors.cyan);
    try {
      execSync(
        `npx prisma db pull --schema=${schemaPath} --print > ${introspectionOutputPath}`,
        { stdio: 'inherit' }
      );
    } catch (error) {
      log('❌ Failed to introspect database. Check your DATABASE_URL environment variable.', colors.red);
      process.exit(1);
    }
    
    // Step 2: Compare the introspection with the current schema
    log('🔄 Comparing schemas...', colors.cyan);
    try {
      // This command will exit with an error if the schema is out of sync
      execSync(
        `npx prisma migrate diff --from-schema-datamodel=${schemaPath} --to-schema-datamodel=${introspectionOutputPath} --exit-code`,
        { stdio: 'pipe' }
      );
      
      log('✅ Your Prisma schema is in sync with the database!', colors.green);
      
      // Clean up
      if (fs.existsSync(introspectionOutputPath)) {
        fs.unlinkSync(introspectionOutputPath);
      }
      
      return true;
    } catch (error) {
      log('⚠️ Schema drift detected! Your Prisma schema is out of sync with the database.', colors.yellow);
      log('📋 Here are the differences:', colors.yellow);
      
      try {
        const diff = execSync(
          `npx prisma migrate diff --from-schema-datamodel=${schemaPath} --to-schema-datamodel=${introspectionOutputPath} --pretty`,
          { encoding: 'utf8' }
        );
        console.log(diff);
      } catch (diffError) {
        log('Failed to generate detailed diff', colors.red);
      }
      
      log('🛠️ To sync your database, run: pnpm run push', colors.cyan);
      
      // Clean up
      if (fs.existsSync(introspectionOutputPath)) {
        fs.unlinkSync(introspectionOutputPath);
      }
      
      return false;
    }
  } catch (error) {
    log(`❌ An unexpected error occurred: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run the check
checkSchemaSync(); 