import { prisma } from "@dub/prisma";
import { createWorkspaceId } from "@/lib/api/workspace-id";
import { nanoid, generateRandomString } from "@dub/utils";
import { redis } from "@/lib/upstash";
import { Prisma } from "@dub/prisma/client";

/**
 * Script to find users without workspaces and create them
 * 
 * Usage:
 *   cd apps/web
 *   npm run script create-missing-workspaces
 *   
 * Options:
 *   --dry-run : Only report users missing workspaces without creating them
 *   --limit=<number> : Limit to a specific number of users to process (default: all)
 *   --after=<date> : Only process users created after this date (format: YYYY-MM-DD)
 */

// Define result types
type WorkspaceCreationResult = 
  | { userId: string; success: true; workspace: any }
  | { userId: string; success: false; error: string }
  | { userId: string; success: null; dryRun: boolean };

async function main() {
  // Process command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const afterArg = args.find(arg => arg.startsWith('--after='));
  const after = afterArg ? new Date(afterArg.split('=')[1]) : undefined;
  
  console.log(`🔍 Finding users without workspaces...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} users`);
  if (after) console.log(`Only users created after: ${after.toISOString().split('T')[0]}`);
  
  // Find all users that don't have a workspace
  const users = await prisma.user.findMany({
    where: {
      ...(after && { createdAt: { gt: after } })
    },
  });
  
  console.log(`Found ${users.length} total users`);
  
  // Get list of users with workspaces
  const usersWithWorkspaces = await prisma.projectUsers.findMany({
    distinct: ['userId'],
    select: { userId: true }
  });
  
  const userIdsWithWorkspaces = new Set(usersWithWorkspaces.map(u => u.userId));
  
  // Filter to users without workspaces
  const usersWithoutWorkspaces = users.filter(user => !userIdsWithWorkspaces.has(user.id));
  
  console.log(`Found ${usersWithoutWorkspaces.length} users without workspaces`);
  
  // Apply limit if specified
  const usersToProcess = limit 
    ? usersWithoutWorkspaces.slice(0, limit) 
    : usersWithoutWorkspaces;
  
  if (usersToProcess.length === 0) {
    console.log(`✅ No users need workspaces created! All users have workspaces.`);
    return;
  }
  
  console.log(`Will process ${usersToProcess.length} users`);
  
  // Create workspaces for each user
  const results: WorkspaceCreationResult[] = [];
  
  for (const user of usersToProcess) {
    console.log(`\nProcessing user: ${user.id} (${user.email || 'no email'})`);
    
    if (dryRun) {
      console.log(`SKIPPING: Dry run mode enabled`);
      results.push({ userId: user.id, success: null, dryRun: true });
      continue;
    }
    
    try {
      const workspace = await createWorkspaceForUser(user);
      console.log(`✅ Created workspace "${workspace.name}" (${workspace.slug}) for user ${user.id}`);
      results.push({ userId: user.id, success: true, workspace });
    } catch (error) {
      console.error(`❌ Failed to create workspace for user ${user.id}:`, error);
      results.push({ userId: user.id, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Print summary
  console.log("\n=== SUMMARY ===");
  if (dryRun) {
    console.log(`Found ${usersToProcess.length} users without workspaces (dry run, no workspaces created)`);
  } else {
    const successful = results.filter(r => r.success === true).length;
    const failed = results.filter(r => r.success === false).length;
    const skipped = results.filter(r => r.success === null).length;
    
    console.log(`Processed ${usersToProcess.length} users:`);
    console.log(`- ${successful} workspaces successfully created`);
    console.log(`- ${failed} workspaces failed to create`);
    if (skipped > 0) console.log(`- ${skipped} users skipped`);
  }
}

/**
 * Create a workspace for a specific user
 */
async function createWorkspaceForUser(user: { id: string, name: string | null, email: string | null }) {
  // Create workspace name based on user info
  const workspaceName = user.name 
    ? `${user.name}'s Workspace` 
    : user.email 
      ? `${user.email.split('@')[0]}'s Workspace` 
      : 'Personal Workspace';
  
  // Generate a slug from the workspace name
  const baseSlug = workspaceName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single one
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  let slug = baseSlug;
  let counter = 1;
  
  // Check if slug exists and add a number if necessary
  while (true) {
    const existingWorkspace = await prisma.project.findUnique({
      where: { slug },
    });
    
    if (!existingWorkspace) break;
    
    // If exists, try with a number suffix
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  // Create the workspace with transaction for safety
  const workspace = await prisma.$transaction(
    async (tx) => {
      return await tx.project.create({
        data: {
          id: createWorkspaceId(),
          name: workspaceName,
          slug,
          // Set high limits for creators
          linksLimit: 1000000, // Effectively unlimited links
          foldersLimit: 10, // Allow folders for creators
          users: {
            create: {
              userId: user.id,
              role: "owner",
              notificationPreference: {
                create: {},
              },
            },
          },
          billingCycleStart: new Date().getDate(),
          invoicePrefix: generateRandomString(8),
          inviteCode: nanoid(24),
          defaultDomains: {
            create: {}, // by default, we give users all the default domains
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 5000,
    },
  );
  
  // Set this workspace as the user's default
  await prisma.user.update({
    where: { id: user.id },
    data: { defaultWorkspace: workspace.slug },
  });
  
  // Set onboarding step to completed
  await redis.set(`onboarding-step:${user.id}`, "completed");
  
  return workspace;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 