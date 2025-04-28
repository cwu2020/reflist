import { prisma } from "@dub/prisma";
import "dotenv-flow/config";

async function main() {
  console.log("Updating workspace limits for all existing workspaces...");
  
  const result = await prisma.project.updateMany({
    where: {
      OR: [
        { linksLimit: { lt: 1000000 } },
        { foldersLimit: { lte: 0 } }
      ]
    },
    data: {
      linksLimit: 1000000, // Effectively unlimited links
      foldersLimit: 10, // Allow folders for creators
    },
  });

  console.log(`Updated ${result.count} workspaces with new limits`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 