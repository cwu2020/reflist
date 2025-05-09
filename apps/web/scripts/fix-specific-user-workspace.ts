/**
 * Script to fix workspace for a specific user
 * 
 * This script can be used to create a workspace for a specific user by ID
 * 
 * Usage:
 * npx tsx apps/web/scripts/fix-specific-user-workspace.ts user_1JTVG03GZ35CYCJ8PEEQKE89K
 */
import "dotenv-flow/config";
import { prisma } from "@dub/prisma";
import { redis } from "@/lib/upstash/redis";
import { createWorkspaceId } from "@/lib/api/workspace-id";
import { nanoid } from "nanoid";
import { generateRandomString } from "@dub/utils";
import { Prisma } from "@dub/prisma/client";

// Get specific user ID from command line
const userId = process.argv[2];

if (!userId) {
  console.error("Please provide a user ID as a command line argument");
  console.error("Example: npx tsx apps/web/scripts/fix-specific-user-workspace.ts user_1JTVG03GZ35CYCJ8PEEQKE89K");
  process.exit(1);
}

async function main() {
  console.log(`Starting script to fix workspace for user ${userId}...`);
  
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          projects: true 
        }
      }
    }
  });
  
  if (!user) {
    console.error(`User ${userId} not found in the database.`);
    process.exit(1);
  }
  
  console.log(`Found user: ${user.email || 'No email'} (created: ${user.createdAt})`);
  console.log(`Workspace count: ${user._count.projects}`);
  
  // Check if user already has workspaces
  if (user._count.projects > 0) {
    console.log(`User ${userId} already has ${user._count.projects} workspace(s). Checking for default workspace setting...`);
    
    // Check if user has default workspace set
    const userWithDefault = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspace: true }
    });
    
    if (userWithDefault?.defaultWorkspace) {
      console.log(`User already has default workspace set: ${userWithDefault.defaultWorkspace}`);
      
      // Get the workspace to display details
      const workspace = await prisma.project.findUnique({
        where: { slug: userWithDefault.defaultWorkspace }
      });
      
      if (workspace) {
        console.log(`Workspace details: ID: ${workspace.id}, Name: ${workspace.name}, Slug: ${workspace.slug}`);
      } else {
        console.log(`Warning: Default workspace slug ${userWithDefault.defaultWorkspace} set but workspace not found`);
      }
      
      // Ask if user wants to create a new workspace anyway
      console.log("User already has workspaces. If you want to create a new one anyway, run with --force flag");
      
      if (!process.argv.includes("--force")) {
        console.log("Exiting without creating new workspace. Use --force to override.");
        process.exit(0);
      }
    }
  }
  
  console.log("Creating new workspace for user...");
  
  try {
    const workspace = await createWorkspaceForUser(user);
    console.log(`Successfully created workspace ${workspace.slug} for user ${userId}`);
  } catch (error) {
    console.error(`Error creating workspace for user ${userId}:`, error);
    process.exit(1);
  }
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