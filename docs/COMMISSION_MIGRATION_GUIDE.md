# Commission Split Migration Guide

This document provides instructions for safely applying the commission split schema migration to both development and production environments.

## Background

The commission claiming architecture has been redesigned to improve tracking of claimed commissions. The main schema change involves:

1. Renaming `claimedById` to `claimedByPartnerId` (for backward compatibility)
2. Adding a new `claimedByUserId` column to track which user claimed the commission
3. Adding appropriate foreign key constraints and indexes

## Pre-Migration Steps

Before performing the migration on any environment:

1. Back up the database (if possible)
2. Ensure all commission splits are reset to unclaimed status to avoid data inconsistency

## Migration Process for Development Environment

We've successfully applied the migration to the development environment using the following process:

### 1. Reset Commission Splits (if needed)

Use the `reset-claimed-commissions.ts` script to reset all commission splits to unclaimed status:

```bash
npx ts-node apps/web/scripts/reset-claimed-commissions.ts
```

This script:
- Resets `claimed` to `false`
- Sets `claimedAt` to `null`
- Sets `claimedById` to `null`

### 2. Apply Schema Migration

Use the `apply-commission-migration.ts` script to apply the schema changes:

```bash
npx ts-node apps/web/scripts/apply-commission-migration.ts
```

This script:
- Runs inside a transaction for safety
- Renames `claimedById` to `claimedByPartnerId`
- Adds the new `claimedByUserId` column
- Adds a foreign key constraint for `claimedByUserId` referencing the `User` table
- Creates an index on `claimedByUserId`

### 3. Verify Migration Success

Use the `verify-commission-migration.ts` script to verify the migration was successful:

```bash
npx ts-node apps/web/scripts/verify-commission-migration.ts
```

This script checks:
- The existence of the renamed column
- The existence of the new column
- The foreign key constraint
- The index on the new column

## Migration Process for Production Environment

For the production environment, follow these steps:

### 1. Scheduled Maintenance Window

Schedule a maintenance window when commission claiming activity is minimal.

### 2. Backup

Create a database backup before proceeding.

### 3. Deploy New Code

Ensure all new code (services, endpoints, etc.) is deployed and ready to use the new schema.

### 4. Apply Migration

Run the migration script with production database credentials:

```bash
# Using a different .env file for production credentials
DATABASE_URL=<production-db-url> npx ts-node apps/web/scripts/apply-commission-migration.ts
```

### 5. Verify Migration

Run the verification script to confirm the migration was successful:

```bash
DATABASE_URL=<production-db-url> npx ts-node apps/web/scripts/verify-commission-migration.ts
```

### 6. Monitoring

After the migration:
- Monitor error rates in the commission claiming process
- Verify that new commissions are claimed correctly
- Check that the data is stored properly in the database

## Rollback Plan

If issues are encountered, follow these steps:

1. **Immediate Rollback**: If the migration fails during the schema change, the transaction will automatically roll back.

2. **Post-Migration Rollback**: If issues are discovered after the migration:
   
   a. Create a rollback script that:
      - Drops the foreign key constraint and index
      - Drops the `claimedByUserId` column
      - Renames `claimedByPartnerId` back to `claimedById`

   b. Apply the rollback script:
      ```bash
      DATABASE_URL=<db-url> npx ts-node apps/web/scripts/rollback-commission-migration.ts
      ```

## Migration Notes and Observations

- The migration adds columns without removing any existing functionality, making it relatively safe
- The transaction wrapping ensures database consistency during the migration
- The verification step helps confirm the migration was applied correctly
- Make sure to deploy all application code that uses the new columns before applying the migration

## Scripts Reference

- `reset-claimed-commissions.ts`: Resets commission splits to unclaimed status
- `apply-commission-migration.ts`: Applies the schema changes in a transaction
- `verify-commission-migration.ts`: Verifies the migration was successful

These scripts are stored in the `apps/web/scripts/` directory. 