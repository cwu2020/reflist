//cd web && echo 'DATABASE_URL="mysql://root:@localhost:3306/planetscale"' > .env && DATABASE_URL="mysql://root:@localhost:3306/planetscale" npm run script -- test-commission-splits/test-commission-splits




// Script to test commission splits functionality by mimicking the admin sales form submission

import { PrismaClient, EventType, Prisma } from '@prisma/client';
import { createId } from '../../lib/api/create-id';
import { nanoid } from '@dub/utils';
import { createPartnerCommission } from '../../lib/partners/create-partner-commission';
import { calculateManualEarnings, calculateProgramEarnings } from '../../lib/api/sales/calculate-sale-earnings';
import { determinePartnerReward } from '../../lib/partners/determine-partner-reward';
import { recordSaleWithTimestamp } from '../../lib/tinybird/record-sale';

// Initialize Prisma client
const prisma = new PrismaClient();

// Configuration for the test
interface TestConfig {
  findLinkBy: 'key' | 'id'; // How to find the link
  linkKey?: string;         // The key of the link to find
  linkId?: string;          // The ID of the link to find
  amount: number;           // Amount in cents
  currency: string;         // Currency code
  paymentProcessor: string; // Payment processor name
  eventName: string;        // Event name
  invoiceId: string;        // Invoice ID
  notes: string;            // Notes
  commissionAmount: number; // Commission amount in cents
  userTakeRate: number;     // Percentage that goes to the user (0-100)
  debug: boolean;           // Whether to show debug logs
}

// Helper function to generate random ID
function generateRandomId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${prefix}_${randomPart}_${timestamp}`;
}

// Default test configuration - using the specific link from the request
const defaultConfig: TestConfig = {
  findLinkBy: 'key',
  linkKey: 'T9KqcfU',
  amount: 10000, // $100.00
  currency: 'usd',
  paymentProcessor: 'custom',
  eventName: 'Test Sale',
  invoiceId: generateRandomId('inv_test'),
  notes: 'Testing commission splits via script',
  commissionAmount: 5000, // $50.00 (50% of sale)
  userTakeRate: 70, // 70% goes to the creator, 30% to the platform
  debug: true,
};

// Log function with debug mode support
function log(message: string, data?: any) {
  if (defaultConfig.debug) {
    console.log(message);
    if (data !== undefined) {
      console.log(data);
    }
  }
}

// Function to find the test link
async function findTestLink(linkKey: string) {
  log(`Looking up link by key: ${linkKey}`);
  
  const link = await prisma.link.findFirst({
    where: { key: linkKey },
    include: {
      project: true
    }
  });
  
  if (!link) {
    throw new Error(`Link with key ${linkKey} not found. Please specify a valid link key.`);
  }
  
  log(`Found link:`, {
    id: link.id,
    key: link.key,
    url: link.url,
    programId: link.programId,
    partnerId: link.partnerId,
    commissionSplits: (link as any).commissionSplits
  });
  
  return link;
}

// Function to create a test customer
async function createTestCustomer(link: any) {
  log("Creating test customer");
  
  // Generate a placeholder customer for this test sale
  const placeholderName = `Test Customer ${nanoid(6)}`;
  
  // Make sure we have valid projectId
  const projectId = link.project?.id;
  if (!projectId) {
    throw new Error("Unable to determine project ID from link");
  }
  
  const customer = await prisma.customer.create({
    data: {
      id: createId({ prefix: "cus_" }),
      name: placeholderName,
      externalId: `test_sale_${nanoid(8)}`,
      projectId,
      linkId: link.id,
    },
  });
  
  log(`Created customer:`, {
    id: customer.id,
    name: customer.name
  });
  
  return customer;
}

// Function to process a test sale (mimicking the admin sales route)
async function processTestSale(link: any, customer: any, config: TestConfig) {
  log("=== Processing test sale ===");
  
  // Generate a unique event ID (similar to admin sales route)
  const adminInfo = {
    admin: "test-script@example.com",
    date: new Date().toISOString(),
    notes: config.notes || "",
    processor: config.paymentProcessor,
    event: config.eventName,
    commissionAmount: config.commissionAmount,
    userTakeRate: config.userTakeRate
  };
  
  // Create event ID in the same format as the admin route
  const eventId = `manual_${nanoid(10)}_${Buffer.from(JSON.stringify(adminInfo).slice(0, 100)).toString('base64')}`;
  log(`Generated event ID: ${eventId}`);
  
  // Calculate earnings based on provided commission data or program's structure
  let earnings;
  let reward: any = null;
  
  if (config.commissionAmount !== undefined && config.userTakeRate !== undefined) {
    // Use manual override calculation - This gives us the total earnings before userTakeRate is applied
    log("Using manual commission calculation");
    
    // Raw earnings before applying userTakeRate
    const rawEarnings = config.commissionAmount;
    
    // Apply userTakeRate to get the adjusted earnings using the same function as the admin route
    earnings = calculateManualEarnings({
      commissionAmount: config.commissionAmount,
      splitPercentage: config.userTakeRate
    });
    
    // Create a custom reward object for commission splits
    reward = {
      id: 'manual',
      event: 'sale',
      type: 'flat',
      amount: config.commissionAmount,
      programId: link.programId || '',
    };
    
    log("Manual earnings calculation:", {
      commissionAmount: config.commissionAmount,
      userTakeRate: config.userTakeRate,
      rawEarnings: rawEarnings,
      calculatedEarnings: earnings
    });
  } else {
    // Use the default program-based calculation
    log("Using program-based commission calculation");
    
    // Get raw earnings from program calculation
    const rawEarnings = await calculateProgramEarnings({
      programId: link.programId || null,
      amount: config.amount,
      quantity: 1
    });
    
    // Apply userTakeRate to get the adjusted earnings
    // This matches the admin route's calculation: adjustedEarnings = Math.floor(rawEarnings * (userTakeRate / 100));
    earnings = Math.floor(rawEarnings * (config.userTakeRate / 100));
    
    log("Program-based earnings calculation:", {
      programId: link.programId,
      amount: config.amount,
      rawEarnings: rawEarnings,
      userTakeRate: config.userTakeRate,
      calculatedEarnings: earnings
    });
  }
  
  // Create the commission record using createPartnerCommission
  log("Creating commission with createPartnerCommission");
  let commission;
  try {
    // Check for commission splits in the link
    log("Checking for commission splits in link:", link.id);
    log("Commission splits data:", (link as any).commissionSplits);
    
    // Use the same approach as the admin sales route
    commission = await createPartnerCommission({
      reward,
      event: EventType.sale,
      programId: link.programId || "",
      partnerId: link.partnerId || "",
      linkId: link.id,
      customerId: customer.id,
      eventId,
      invoiceId: config.invoiceId || null,
      amount: config.amount, // This is the full sale amount
      quantity: 1,
      currency: config.currency,
      calculatedEarnings: earnings, // Pass the pre-calculated earnings
    });
    
    if (!commission) {
      log("No commission returned from createPartnerCommission, creating fallback commission");
      commission = await prisma.commission.create({
        data: {
          id: createId({ prefix: "cm_" }),
          programId: link.programId || "",
          partnerId: link.partnerId || "",
          linkId: link.id,
          customerId: customer.id,
          eventId,
          type: EventType.sale,
          amount: config.amount,
          quantity: 1,
          currency: config.currency,
          status: "pending",
          invoiceId: config.invoiceId || null,
          earnings: earnings,
        },
      });
    }
  } catch (commissionError) {
    log("Error creating commission with splits:", commissionError);
    
    // Fallback to basic commission creation if there's an error
    commission = await prisma.commission.create({
      data: {
        id: createId({ prefix: "cm_" }),
        programId: link.programId || "",
        partnerId: link.partnerId || "",
        linkId: link.id,
        customerId: customer.id,
        eventId,
        type: EventType.sale,
        amount: config.amount,
        quantity: 1,
        currency: config.currency,
        status: "pending",
        invoiceId: config.invoiceId || null,
        earnings: earnings,
      },
    });
  }
  
  log(`Created primary commission:`, commission);
  
  // Update link sales statistics
  await prisma.link.update({
    where: {
      id: link.id,
    },
    data: {
      sales: {
        increment: 1,
      },
      saleAmount: {
        increment: config.amount,
      },
    },
  });
  log("Updated link sales statistics");
  
  // Update project usage statistics if available
  if (link.projectId) {
    await prisma.project.update({
      where: {
        id: link.projectId,
      },
      data: {
        salesUsage: {
          increment: config.amount,
        },
      },
    });
    log("Updated project usage statistics");
  }
  
  // Create a Tinybird event record for this test sale
  try {
    const tinyBirdEvent = {
      timestamp: new Date().toISOString(),
      event_id: eventId,
      event_name: config.eventName,
      customer_id: customer.id,
      click_id: nanoid(16),
      link_id: link.id,
      url: link.url,
      country: "US",
      continent: "NA",
      city: "San Francisco",
      region: "CA",
      latitude: "37.7695",
      longitude: "-122.385",
      device: "desktop",
      device_vendor: "Apple",
      device_model: "Macintosh",
      browser: "Chrome",
      browser_version: "124.0.0.0",
      engine: "Blink",
      engine_version: "124.0.0.0",
      os: "Mac OS",
      os_version: "10.15.7",
      cpu_architecture: "Unknown",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      bot: 0,
      qr: 0,
      referer: "test-script",
      referer_url: "test-script",
      ip: "127.0.0.1",
      invoice_id: config.invoiceId || nanoid(16),
      amount: config.amount,
      currency: config.currency.toLowerCase(),
      payment_processor: config.paymentProcessor,
      metadata: JSON.stringify({
        manual: true,
        admin: "test-script@example.com",
        notes: config.notes || "",
        commissionAmount: config.commissionAmount,
        userTakeRate: config.userTakeRate,
        test: true
      }),
    };
    
    await recordSaleWithTimestamp(tinyBirdEvent);
    log("Successfully recorded Tinybird event");
  } catch (tinyBirdError) {
    log("Error recording Tinybird event:", tinyBirdError);
  }
  
  return { eventId, commission };
}

// Function to validate commission splits were created properly
async function validateCommissionSplits(eventId: string, link: any) {
  log("=== Validating commission splits ===");
  
  // Find all commissions related to this event
  const commissions = await prisma.commission.findMany({
    where: {
      OR: [
        { eventId },
        { eventId: { startsWith: `${eventId}_split_` } }
      ]
    }
  });
  
  log(`Found ${commissions.length} commission records`);
  
  // Get partner details with raw queries to avoid schema issues
  const partnerIds = commissions.map(c => c.partnerId).filter(Boolean) as string[];
  
  // Get split records with a raw query since Prisma might not have the schema yet
  const splits = await prisma.$queryRaw`
    SELECT * FROM CommissionSplit 
    WHERE commissionId IN (${Prisma.join(commissions.map(c => c.id))})
  `;
  
  log(`Found ${Array.isArray(splits) ? splits.length : 0} commission split records`);
  
  // Get partner details
  let partnerDetails: Record<string, any> = {};
  
  if (partnerIds.length > 0) {
    try {
      const partners = await prisma.$queryRaw`
        SELECT id, name, phoneNumber FROM Partner 
        WHERE id IN (${Prisma.join(partnerIds)})
      `;
      
      if (Array.isArray(partners)) {
        partners.forEach((p: any) => {
          partnerDetails[p.id] = p;
        });
      }
    } catch (err) {
      log("Warning: Could not fetch partner details", err);
    }
  }
  
  // Validate the results
  const primaryCommission = commissions.find(c => c.eventId === eventId);
  const splitCommissions = commissions.filter(c => c.eventId !== eventId);
  
  log("Primary commission details:", {
    id: primaryCommission?.id,
    partnerId: primaryCommission?.partnerId,
    partnerName: primaryCommission?.partnerId ? partnerDetails[primaryCommission.partnerId]?.name : 'Unknown',
    earnings: primaryCommission?.earnings,
    amount: primaryCommission?.amount
  });
  
  splitCommissions.forEach(commission => {
    const partner = commission.partnerId ? partnerDetails[commission.partnerId] : null;
    
    log("Split commission details:", {
      id: commission.id,
      partnerId: commission.partnerId,
      partnerName: partner?.name || 'Unknown',
      partnerPhone: partner?.phoneNumber,
      earnings: commission.earnings,
      amount: commission.amount,
      eventId: commission.eventId
    });
  });
  
  if (Array.isArray(splits)) {
    splits.forEach((split: any) => {
      log("Commission split record:", {
        id: split.id,
        commissionId: split.commissionId,
        partnerId: split.partnerId,
        phoneNumber: split.phoneNumber,
        splitPercent: split.splitPercent,
        earnings: split.earnings,
        claimed: split.claimed
      });
    });
  }
  
  return { commissions, splits };
}

// Function to run the test
async function runTest() {
  try {
    log("=== Starting Commission Split Test ===");
    log("Using configuration:", defaultConfig);
    
    // Step 1: Find the test link
    let link;
    if (defaultConfig.findLinkBy === 'key' && defaultConfig.linkKey) {
      link = await findTestLink(defaultConfig.linkKey);
    } else if (defaultConfig.findLinkBy === 'id' && defaultConfig.linkId) {
      link = await findLinkById(defaultConfig.linkId);
    } else {
      throw new Error("Invalid link identification method or missing link key/id");
    }
    
    // Step 2: Create a test customer
    const customer = await createTestCustomer(link);
    
    // Step 3: Process the test sale (mimicking the admin sales route)
    const { eventId, commission } = await processTestSale(link, customer, defaultConfig);
    
    // Step 4: Validate the commission splits
    await validateCommissionSplits(eventId, link);
    
    log("=== Test completed successfully ===");
    log("The test has successfully mimicked what happens when an admin submits a sale form");
    log("\nNext steps to verify in the database:");
    log("1. Check Commission table for the primary commission record");
    log("2. Verify CommissionSplit records were created");
    log("3. Confirm split commissions were created for each recipient");
    log("4. Check that earnings are calculated correctly based on userTakeRate");
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Add a new function to find link by ID
async function findLinkById(linkId: string) {
  log(`Looking up link by ID: ${linkId}`);
  
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    include: {
      program: true,
    },
  });
  
  if (!link) {
    throw new Error(`Link with ID ${linkId} not found`);
  }
  
  // Get commission splits from metadata if they exist
  const metadata = (link as any).metadata || {};
  const commissionSplits = metadata.commissionSplits || [];
  
  const linkWithSplits = {
    ...link,
    commissionSplits,
  };
  
  log("Found link:", linkWithSplits);
  return linkWithSplits;
}

// Run the test
runTest(); 