#!/usr/bin/env node

/**
 * This script handles Prisma database migrations and client generation during deployment.
 * It specifically works with PlanetScale (schema-less database) using db push.
 */

const { execSync } = require('child_process');
const path = require('path');

// Get the absolute path to the Prisma schema directory
const SCHEMA_PATH = path.resolve(__dirname, '../schema');

// Log the environment we're in
console.log(`Deploying Prisma in ${process.env.NODE_ENV || 'development'} environment`);

// Run the database push (for schema-less databases like PlanetScale)
try {
  console.log('Pushing Prisma schema changes to database...');
  // We use --accept-data-loss because with PlanetScale this is generally safe
  // as long as you have properly configured your schema
  execSync(`npx prisma db push --schema="${SCHEMA_PATH}" --accept-data-loss`, { stdio: 'inherit' });
  console.log('Database schema updated successfully.');
} catch (error) {
  console.error('Failed to push database schema:', error);
  process.exit(1);
}

// Generate the Prisma client
try {
  console.log('Generating Prisma client...');
  execSync(`npx prisma generate --schema="${SCHEMA_PATH}"`, { stdio: 'inherit' });
  console.log('Prisma client generated successfully.');
} catch (error) {
  console.error('Failed to generate Prisma client:', error);
  process.exit(1);
}

console.log('Prisma deployment completed successfully.'); 