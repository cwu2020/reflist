#!/usr/bin/env node

/**
 * Pre-deployment check script
 * This script runs all necessary checks before deploying to production
 * 
 * Usage:
 *   node scripts/pre-deploy-check.js
 */

const { execSync } = require('child_process');
const { EOL } = require('os');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, errorMessage) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    log(`❌ ${errorMessage}`, colors.red);
    log(`Error details: ${error.message}`, colors.red);
    return null;
  }
}

// Header
log(`${EOL}🚀 ${colors.bold}${colors.cyan}PRE-DEPLOYMENT CHECKS${colors.reset}${EOL}`);
log(`Running checks before deployment...${EOL}`);

// Check 1: Prisma schema synchronization
log(`${colors.bold}[1/4] Checking Prisma schema synchronization${colors.reset}`);
const schemaCheckResult = runCommand('pnpm run db:check', 'Prisma schema synchronization check failed');
if (schemaCheckResult === null) {
  log(`${EOL}⚠️  ${colors.yellow}${colors.bold}Warning: Database schema is out of sync. Run 'pnpm run db:sync' to fix.${colors.reset}${EOL}`);
} else {
  log(`${colors.green}✅ Prisma schema is in sync with the database.${colors.reset}${EOL}`);
}

// Check 2: Dependencies
log(`${colors.bold}[2/4] Checking dependencies${colors.reset}`);
const depsCheckResult = runCommand('pnpm install --frozen-lockfile', 'Dependency check failed');
if (depsCheckResult === null) {
  log(`${EOL}❌ ${colors.red}${colors.bold}Error: Dependency check failed. Fix package issues before deploying.${colors.reset}${EOL}`);
  process.exit(1);
} else {
  log(`${colors.green}✅ Dependencies are up to date.${colors.reset}${EOL}`);
}

// Check 3: Build check
log(`${colors.bold}[3/4] Checking build${colors.reset}`);
const buildCheckResult = runCommand('pnpm run build', 'Build check failed');
if (buildCheckResult === null) {
  log(`${EOL}❌ ${colors.red}${colors.bold}Error: Build check failed. Fix build errors before deploying.${colors.reset}${EOL}`);
  process.exit(1);
} else {
  log(`${colors.green}✅ Build check passed.${colors.reset}${EOL}`);
}

// Check 4: Linting
log(`${colors.bold}[4/4] Running linter${colors.reset}`);
const lintCheckResult = runCommand('pnpm run lint', 'Linting check failed');
if (lintCheckResult === null) {
  log(`${EOL}⚠️  ${colors.yellow}${colors.bold}Warning: Linting issues detected. Consider fixing before deploying.${colors.reset}${EOL}`);
} else {
  log(`${colors.green}✅ Linting check passed.${colors.reset}${EOL}`);
}

// Summary
log(`${colors.bold}${colors.cyan}DEPLOYMENT CHECK SUMMARY${colors.reset}`);
log(`${colors.green}✅ All critical checks passed!${colors.reset}`);
log(`${EOL}${colors.bold}You can now deploy to production.${colors.reset}`);
log(`Remember to run 'git push' to trigger the CI/CD pipeline, which will sync the Prisma schema with the database.${EOL}`); 