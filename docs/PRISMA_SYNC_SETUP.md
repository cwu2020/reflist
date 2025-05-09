# Prisma Database Sync Setup Guide

This guide explains how to set up the required GitHub secrets for the Prisma database synchronization workflow.

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository to enable the Prisma database synchronization workflow:

1. `DATABASE_URL` - The full PlanetScale connection string for your production database
2. `DB_USERNAME` - Your PlanetScale database username
3. `DB_PASSWORD` - Your PlanetScale database password
4. `DB_HOST` - The PlanetScale database host (e.g., `aws.connect.psdb.cloud`)
5. `DB_NAME` - Your database name (e.g., `reflist`)

## How to Add GitHub Secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" and then "Actions"
4. Click on "New repository secret"
5. Add each of the secrets listed above

Example values (replace with your actual credentials):

- `DATABASE_URL`: `mysql://username:password@aws.connect.psdb.cloud/reflist?sslaccept=strict`
- `DB_USERNAME`: `username`
- `DB_PASSWORD`: `password`
- `DB_HOST`: `aws.connect.psdb.cloud`
- `DB_NAME`: `reflist`

## Local Development Security

For local development:

1. Store your database credentials in your `.env.local` file
2. Use the following variable names in `.env.local`:
   ```
   DATABASE_URL=mysql://username:password@aws.connect.psdb.cloud/reflist?sslaccept=strict
   DATABASE_USERNAME=username
   DATABASE_PASSWORD=password
   DB_HOST=aws.connect.psdb.cloud
   DB_NAME=reflist
   ```
3. **Never commit database credentials to Git**. We've added the `.env.local` file and `cleanup-direct.js` to `.gitignore` to prevent accidental commits.

## When the Workflow Runs

The Prisma database sync workflow will run:
- When you push to the main branch
- When you manually trigger it from the Actions tab

## What the Workflow Does

1. Generates the Prisma client based on your schema
2. Applies schema changes to your production database using `prisma db push`
3. Cleans up any orphaned records (like accounts without associated users)
4. Reports success or failure

## Troubleshooting

If the workflow fails, check the GitHub Actions logs for detailed error messages. Common issues include:

- Incorrect database credentials in GitHub secrets
- Schema validation errors
- Insufficient permissions for the database user

## Manual Execution

You can manually run this workflow at any time:

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select "Prisma Database Sync" from the list of workflows
4. Click "Run workflow" button on the right side
5. Select the branch to run from and click "Run workflow" 