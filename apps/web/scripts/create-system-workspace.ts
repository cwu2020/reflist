import { prisma } from "@dub/prisma";

async function main() {
  // Check if system workspace already exists
  const existingWorkspace = await prisma.project.findFirst({
    where: { 
      name: "System" 
    },
  });

  if (!existingWorkspace) {
    // Create the system workspace
    const systemWorkspace = await prisma.project.create({
      data: {
        name: "System",
        slug: "system",
        plan: "enterprise", // Give it the highest tier plan
        billingCycleStart: 1, // Required field in ProjectCreateInput
      },
    });
    
    // Create defaultDomains record separately
    await prisma.defaultDomains.create({
      data: {
        projectId: systemWorkspace.id,
        reflist: true,
      },
    });
    
    console.log("✅ System workspace created with ID:", systemWorkspace.id);
    
    // Now create the domain in that workspace
    await prisma.domain.create({
      data: {
        slug: "refl.ist",
        verified: true,
        primary: true,
        projectId: systemWorkspace.id,
      },
    });
    
    console.log("✅ Default domain 'refl.ist' created successfully");
    
    // Update your constants file or environment variables to use this ID
    console.log("Update your DUB_WORKSPACE_ID constant to:", systemWorkspace.id);
  } else {
    console.log("System workspace already exists with ID:", existingWorkspace.id);
    
    // Check if domain exists
    const existingDomain = await prisma.domain.findUnique({
      where: { slug: "refl.ist" },
    });
    
    if (!existingDomain) {
      // Create the domain in the existing system workspace
      await prisma.domain.create({
        data: {
          slug: "refl.ist",
          verified: true,
          primary: true,
          projectId: existingWorkspace.id,
        },
      });
      console.log("✅ Default domain 'refl.ist' created successfully");
    } else {
      console.log("Domain 'refl.ist' already exists");
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