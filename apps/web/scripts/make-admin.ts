// HOW TO RUN:
// DATABASE_URL="INSERT_YOUR_PRODUCTION_DATABASE_URL_HERE" npx tsx apps/web/scripts/make-admin.ts your-email@example.com

import { prisma } from "@dub/prisma";
import { DUB_WORKSPACE_ID } from "@dub/utils";

async function makeUserAdmin(userEmail: string) {
  // First find the user
  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  });
  
  if (!user) {
    console.error(`User with email ${userEmail} not found.`);
    return;
  }
  
  // Check if the user is already an admin
  const existingAdmin = await prisma.projectUsers.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId: DUB_WORKSPACE_ID,
      },
    },
  });
  
  if (existingAdmin) {
    console.log(`User ${userEmail} is already an admin.`);
    return;
  }
  
  // Add user to the admin workspace
  const adminUser = await prisma.projectUsers.create({
    data: {
      userId: user.id,
      projectId: DUB_WORKSPACE_ID,
      role: "owner", // or "member"
    }
  });
  
  console.log(`User ${userEmail} is now an admin!`);
}

// Check if email is provided as command line argument
const email = process.argv[2];
if (!email) {
  console.error("Please provide an email address as an argument.");
  console.error("Example: npx tsx apps/web/scripts/make-admin.ts your-email@example.com");
  process.exit(1);
}

// Run the function with the provided email
makeUserAdmin(email)
  .catch(e => {
    console.error("Error making user admin:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect()); 