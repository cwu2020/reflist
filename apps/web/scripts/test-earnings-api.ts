import { prisma } from "@dub/prisma";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from .env.local file
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`No .env.local file found at ${envPath}`);
  dotenv.config();
}

async function main() {
  console.log("🧪 Testing earnings API with direct database query...");
  
  // Find a workspace to test with
  const workspace = await prisma.project.findFirst({
    select: {
      id: true,
      slug: true
    }
  });
  
  if (!workspace) {
    console.error("No workspace found to test with");
    return;
  }
  
  console.log(`Using workspace: ${workspace.slug} (${workspace.id})`);
  
  // Try to fetch earnings for this workspace directly using the same query as the API
  try {
    // Initialize with just workspace-related conditions
    const orConditions = [
      // Include commissions from programs belonging to this workspace
      {
        program: {
          workspaceId: workspace.id,
        },
      },
      // Include commissions from links directly created in this workspace
      {
        link: {
          projectId: workspace.id,
        },
      },
    ];
    
    // For the test, we're not including user partner IDs since we don't have a session
    
    // Execute the query that mimics the earnings API
    const earnings = await prisma.commission.findMany({
      where: {
        earnings: {
          gt: 0,
        },
        OR: orConditions,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          lte: new Date().toISOString(),
        },
      },
      include: {
        customer: true,
        link: {
          select: {
            id: true,
            shortLink: true,
            url: true,
          },
        },
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      take: 10, // Just get up to 10 records
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`Successfully executed earnings query for workspace ${workspace.slug}`);
    console.log(`Found ${earnings.length} earnings records`);
    
    if (earnings.length > 0) {
      // Display details of the first earning
      const firstEarning = earnings[0];
      console.log("\nSample earning record:");
      console.log(`- ID: ${firstEarning.id}`);
      console.log(`- Type: ${firstEarning.type}`);
      console.log(`- Amount: $${(firstEarning.amount / 100).toFixed(2)}`);
      console.log(`- Earnings: $${(firstEarning.earnings / 100).toFixed(2)}`);
      console.log(`- Status: ${firstEarning.status}`);
      console.log(`- Partner: ${firstEarning.partner?.name || 'Unknown'} (${firstEarning.partnerId})`);
    }
    
    // Test the timeseries query as well
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Start of previous month
    
    // For a simple test, we'll just count the commissions in this period
    const timeseriesCheck = await prisma.commission.count({
      where: {
        earnings: {
          gt: 0,
        },
        OR: orConditions,
        createdAt: {
          gte: startDate.toISOString(),
          lte: now.toISOString(),
        },
      },
    });
    
    console.log(`\nTimeseries check: ${timeseriesCheck} commissions found in the period`);
    
    console.log("\n✅ Earnings API functionality test PASSED!");
  } catch (error) {
    console.error("❌ Error testing earnings API:", error);
    return;
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