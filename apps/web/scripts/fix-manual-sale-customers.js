// Script to fix manual sale customers by adding programId field
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixManualSaleCustomers() {
  console.log("Fixing manual sale customers...");

  // Find all customers with externalId starting with 'manual_sale_'
  const customers = await prisma.customer.findMany({
    where: {
      externalId: {
        startsWith: 'manual_sale_'
      }
    },
    include: {
      link: true
    }
  });

  console.log(`Found ${customers.length} manual sale customers to fix`);

  // Update each customer to have a programId if their link has one
  for (const customer of customers) {
    if (!customer.programId && customer.link?.programId) {
      console.log(`Fixing customer ${customer.id} (${customer.name}): Adding programId ${customer.link.programId}`);

      await prisma.customer.update({
        where: {
          id: customer.id
        },
        data: {
          programId: customer.link.programId
        }
      });
    } else if (!customer.programId) {
      console.log(`Warning: Cannot fix customer ${customer.id} (${customer.name}): No program ID available from link`);
    } else {
      console.log(`Customer ${customer.id} already has programId: ${customer.programId}`);
    }
  }

  console.log("Manual sale customers update completed");
}

// Run the function
fixManualSaleCustomers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 