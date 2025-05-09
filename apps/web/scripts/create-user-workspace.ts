import { prisma } from "@dub/prisma";
import { createWorkspaceId } from "@/lib/api/workspace-id";
import { nanoid, generateRandomString } from "@dub/utils";
import { redis } from "@/lib/upstash";
import { Prisma } from "@dub/prisma/client";

/**
 * Script to create a workspace for a user who doesn't have one
 * 
 * Usage:
 *   cd apps/web
 *   npm run script create-user-workspace <userId>
 *   
 * Example:
 *   npm run script create-user-workspace user_1JTSSPKYQRPC9XPRAKBSTKT3W
 */

async function main() {
  // Get user ID from command line argument
  const userId = process.argv[2];
  
  if (!userId) {
    console.error("❌ Please provide a user ID as argument");
    console.error("Example: npm run script create-user-workspace USER_ID");
    process.exit(1);
  }

  // First check if the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    console.error(`❌ User with ID ${userId} not found`);
    process.exit(1);
  }

  // Check if the user already has any workspaces
  const userProjects = await prisma.projectUsers.findMany({
    where: { userId }
  });
  
  if (userProjects && userProjects.length > 0) {
    console.log(`✅ User already has ${userProjects.length} workspaces. No need to create a new one.`);
    
    // List the workspaces
    const workspaces = await prisma.project.findMany({
      where: { 
        users: {
          some: {
            userId: userId
          }
        }
      }
    });
    
    console.table(workspaces.map(w => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      isDefault: user.defaultWorkspace === w.slug
    })));
    
    process.exit(0);
  }

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
  
  console.log(`Creating personal workspace for user ${userId} with slug: ${slug}`);
  
  try {
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
                userId,
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
    
    console.log(`✅ Successfully created workspace with ID ${workspace.id} and slug ${workspace.slug}`);
    
    // Set this workspace as the user's default
    await prisma.user.update({
      where: { id: userId },
      data: { defaultWorkspace: workspace.slug },
    });
    
    // Set onboarding step to completed
    await redis.set(`onboarding-step:${userId}`, "completed");
    
    console.log(`✅ Set ${workspace.slug} as the default workspace for user ${userId}`);
    console.log(`✅ Set onboarding step to completed for user ${userId}`);
    
    return workspace;
  } catch (error) {
    console.error("❌ Error creating personal workspace:", error);
    return null;
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