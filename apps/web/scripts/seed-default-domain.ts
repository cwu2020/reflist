import { prisma } from "@dub/prisma";

async function main() {
  // Get workspace ID from command line argument or use default
  const workspaceId = process.argv[2];
  
  if (!workspaceId) {
    console.error("Please provide a workspace ID as argument");
    console.error("Example: npx tsx scripts/seed-default-domain.ts YOUR_WORKSPACE_ID");
    process.exit(1);
  }

  // Check if workspace exists
  const workspace = await prisma.project.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    console.error(`Workspace with ID ${workspaceId} not found`);
    process.exit(1);
  }

  // Check if domain already exists to avoid duplicates
  const existingDomain = await prisma.domain.findUnique({
    where: { slug: "refl.ist" },
  });

  if (!existingDomain) {
    // Create the default domain
    await prisma.domain.create({
      data: {
        slug: "refl.ist",
        verified: true,
        primary: true,
        projectId: workspaceId,
      },
    });
    console.log("✅ Default domain 'refl.ist' created successfully");
    
    // Update defaultDomains record for this workspace if it exists
    const defaultDomains = await prisma.defaultDomains.findUnique({
      where: { projectId: workspaceId },
    });
    
    if (defaultDomains) {
      await prisma.defaultDomains.update({
        where: { projectId: workspaceId },
        data: { reflist: true },
      });
      console.log("✅ Updated workspace defaultDomains to include refl.ist");
    } else {
      await prisma.defaultDomains.create({
        data: {
          projectId: workspaceId,
          reflist: true,
        },
      });
      console.log("✅ Created workspace defaultDomains with refl.ist enabled");
    }
    
    console.log(`\nThe domain is now associated with workspace: ${workspace.name} (${workspace.slug})`);
  } else {
    console.log(`Domain 'refl.ist' already exists in project: ${existingDomain.projectId}`);
    if (existingDomain.projectId !== workspaceId) {
      console.log(`⚠️ Note: The domain exists but is associated with a different workspace ID.`);
    }
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