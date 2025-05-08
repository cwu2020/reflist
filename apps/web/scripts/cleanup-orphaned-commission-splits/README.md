# Orphaned CommissionSplit Cleanup Utility

This utility script identifies and cleans up orphaned `CommissionSplit` records - those that reference `Commission` records that no longer exist in the database.

## Background

In the Reflist schema, `CommissionSplit` records have a relationship to `Commission` records through the `commissionId` field. When a `Commission` record is deleted, all associated `CommissionSplit` records should also be deleted via the `onDelete: Cascade` relationship defined in the Prisma schema.

However, if commissions are deleted directly through SQL commands (bypassing Prisma), this cascade deletion doesn't occur, resulting in orphaned `CommissionSplit` records. These orphaned records can cause errors in various parts of the application.

## Usage

Run the script from the project root directory:

```bash
# First, run in dry-run mode to see what would be deleted
cd apps/web
npx ts-node scripts/cleanup-orphaned-commission-splits.ts

# When ready to perform the actual deletion, add the --confirm flag
npx ts-node scripts/cleanup-orphaned-commission-splits.ts --confirm
```

## What the Script Does

1. Retrieves all `CommissionSplit` records from the database
2. Identifies all unique `commissionId` values referenced by these splits
3. Checks which `commissionId` values correspond to actual `Commission` records
4. Identifies any "orphaned" splits (those referencing non-existent commissions)
5. In dry-run mode, shows what would be deleted without making changes
6. With the `--confirm` flag, deletes the orphaned records

## Safety Features

- By default, runs in "dry-run" mode, showing what would be deleted without making changes
- Requires explicit confirmation via the `--confirm` flag to perform actual deletions
- Provides detailed information about each orphaned record before deletion

## Prevention

To prevent orphaned records in the future:

1. Always use the application's API endpoints or Prisma client to delete commissions
2. If you must use direct SQL, remember to delete related `CommissionSplit` records first
3. Check the `DATABASE_NOTES.md` file for proper deletion procedures 