/**
 * Script to find users that don't have a workspace and create one for them
 * 
 * This fixes the issue where some users, particularly those who signed up
 * through the claim process, might not have a workspace created for them.
 * 
 * Usage:
 * npx tsx apps/web/scripts/fix-missing-workspaces.ts
 */
import "dotenv-flow/config";
import { prisma } from "@dub/prisma";
import { redis } from "@/lib/upstash/redis";
import { createId } from "@/lib/api/create-id";
import { createWorkspaceId } from "@/lib/api/workspace-id";
import { nanoid } from "nanoid";
import { generateRandomString } from "@dub/utils";
import { Prisma } from "@dub/prisma/client";

async function main() {
  console.log("Starting script to fix users without workspaces...");
  
  // Find all users without workspace associations
  console.log("Finding users without workspaces...");
  const usersWithoutWorkspaces = await prisma.user.findMany({
    where: {
      projects: {
        none: {}
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });
  
  console.log(`Found ${usersWithoutWorkspaces.length} users without workspaces.`);
  
  if (usersWithoutWorkspaces.length === 0) {
    console.log("No users found without workspaces. Exiting.");
    return;
  }
  
  console.log("Starting to create workspaces for users...");
  
  // Process each user
  for (const user of usersWithoutWorkspaces) {
    console.log(`Processing user ${user.id} (${user.email || 'no email'})...`);
    
    try {
      await createWorkspaceForUser(user);
    } catch (error) {
      console.error(`Error creating workspace for user ${user.id}:`, error);
    }
  }
  
  console.log("Completed workspace creation process.");
}

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
  
  console.log(`Creating personal workspace for user ${user.id} with slug: ${slug}`);
  
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
  
  console.log(`Successfully created workspace with ID ${workspace.id} and slug ${workspace.slug}`);
  
  // Set this workspace as the user's default
  await prisma.user.update({
    where: { id: user.id },
    data: { defaultWorkspace: workspace.slug },
  });
  
  // Set onboarding step to completed
  await redis.set(`onboarding-step:${user.id}`, "completed");
  
  console.log(`Set ${workspace.slug} as the default workspace for user ${user.id}`);
  console.log(`Set onboarding step to completed for user ${user.id}`);
  
  return workspace;
}

// Run the script
main()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed with error:", error);
    process.exit(1);
  }); 