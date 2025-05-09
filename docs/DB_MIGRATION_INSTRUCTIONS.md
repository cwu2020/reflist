# Database Migration Instructions

## Safely Committing Changes

After removing credentials from code, follow these steps to safely commit changes:

1. **Verify .gitignore includes sensitive files**:
   - Make sure `.env.local` and `cleanup-direct.js` are in the `.gitignore` file
   - This prevents accidentally committing files with credentials

2. **Use env.example instead of .env files**:
   - Copy `env.example` to `.env.local` and add your real credentials to the local copy
   - Only commit `env.example` with placeholder values

3. **Before pushing to GitHub**:
   - Run `git status` to verify no sensitive files are staged
   - Check staged files with `git diff --staged` to ensure no credentials are included

## Setting Up Local Environment

1. **Copy example environment file**:
   ```bash
   cp env.example .env.local
   ```

2. **Add your database credentials to .env.local**:
   ```
   DATABASE_URL=mysql://your_actual_username:your_actual_password@aws.connect.psdb.cloud/reflist?sslaccept=strict
   DATABASE_USERNAME=your_actual_username
   DATABASE_PASSWORD=your_actual_password
   DB_HOST=aws.connect.psdb.cloud
   DB_NAME=reflist
   ```

3. **Use database scripts**:
   - `pnpm run db:check` - Check if your Prisma schema matches the database
   - `pnpm run db:sync` - Sync your Prisma schema with the database
   - `pnpm run db:cleanup` - Clean up orphaned records

## GitHub Actions Workflow

The GitHub Actions workflow (`prisma-sync.yml`) will automatically:
1. Sync your Prisma schema with the production database on every push to main
2. Clean up orphaned records to prevent relationship integrity issues

## Credentials Management

- **Never store credentials in code** - Always use environment variables
- **Don't commit .env.local** - Keep it local only
- **Use GitHub Secrets** - For CI/CD workflows, store credentials as GitHub Secrets

## Database Schema Changes

When making database schema changes:

1. Update the Prisma schema files
2. Test locally with `pnpm run db:check`
3. Apply changes locally with `pnpm run db:sync`
4. Commit the schema changes to Git
5. Push to GitHub - the CI/CD workflow will apply them to production

## Troubleshooting

If you encounter database errors:

1. **Check your local .env.local file**:
   - Verify correct credentials format
   - Ensure environment variable names match what the code expects

2. **Database permission issues**:
   - Verify your account has the necessary permissions
   - Test connectivity with a simple query

3. **Out-of-sync schemas**:
   - Run `pnpm run db:check` to identify differences
   - Update your schema or push changes to fix mismatches

4. **Orphaned records**:
   - Use `pnpm run db:cleanup` to clean up orphaned records
   - Check for foreign key constraint issues 