// Script to add a manual sale record with Tinybird event logging
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Initialize Prisma client
const prisma = new PrismaClient();

// Generate a random ID (replacing nanoid)
function nanoid(length = 10) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Direct implementation of basic Tinybird API call
async function recordSaleEvent(event) {
  const TINYBIRD_API_KEY = process.env.TINYBIRD_API_KEY;
  const TINYBIRD_API_URL = process.env.TINYBIRD_API_URL || 'https://api.us-east.aws.tinybird.co';
  
  if (!TINYBIRD_API_KEY) {
    console.error('TINYBIRD_API_KEY is not defined in environment variables');
    return;
  }

  try {
    const url = `${TINYBIRD_API_URL}/v0/events?name=dub_sale_events`;
    console.log(`Sending event to Tinybird: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYBIRD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tinybird API error: ${response.status} ${text}`);
    }
    
    const data = await response.json();
    console.log('Tinybird response:', data);
    return data;
  } catch (error) {
    console.error('Error sending event to Tinybird:', error);
    throw error;
  }
}

async function addManualSale() {
  // Find the link by its key
  const linkKey = "Astmamv";
  
  const link = await prisma.link.findFirst({
    where: {
      key: linkKey
    },
    include: {
      project: true
    }
  });
  
  if (!link) {
    console.error(`Link with key ${linkKey} not found`);
    return;
  }
  
  console.log(`Found link: ${link.key} (${link.id})`);
  
  // Create admin info for the eventId
  const adminInfo = {
    admin: "test-admin@example.com",
    date: new Date().toISOString(),
    notes: "Test manual sale created via script",
    processor: "stripe",
    event: "Manual Sale"
  };
  
  // Generate event ID
  const eventId = `manual_${nanoid(10)}_${Buffer.from(JSON.stringify(adminInfo).slice(0, 100)).toString('base64')}`;
  
  // Create a placeholder customer
  const placeholderName = `Manual Sale Customer ${nanoid(6)}`;
  
  const customer = await prisma.customer.create({
    data: {
      id: `cus_${nanoid(20)}`,
      name: placeholderName,
      externalId: `manual_sale_${nanoid(8)}`,
      programId: link.programId || "",
      projectId: link.projectId,
      linkId: link.id,
    },
  });
  
  console.log(`Created customer: ${customer.name} (${customer.id})`);

  // Define sale amount
  const amount = 12500; // $125.00
  
  // Create the commission record
  const commission = await prisma.commission.create({
    data: {
      id: `cm_${nanoid(20)}`,
      programId: link.programId || "",
      partnerId: link.partnerId || "",
      linkId: link.id,
      customerId: customer.id,
      eventId,
      type: "sale",
      amount: amount,
      quantity: 1,
      currency: "usd",
      status: "pending",
      invoiceId: `inv_${nanoid(10)}`,
      earnings: amount * 0.1, // Assumes 10% earnings
    },
  });
  
  console.log(`Created commission: ${commission.id} for $${amount/100}`);
  
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
        increment: amount,
      },
    },
  });
  
  console.log(`Updated link stats for ${link.key}`);
  
  // Update project usage statistics if available
  if (link.projectId) {
    await prisma.project.update({
      where: {
        id: link.projectId,
      },
      data: {
        salesUsage: {
          increment: amount,
        },
      },
    });
    
    console.log(`Updated project stats for ${link.projectId}`);
  }

  // Create a Tinybird event
  try {
    const tinyBirdEvent = {
      timestamp: new Date().toISOString(),
      event_id: eventId,
      event_name: "Manual Sale",
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
      referer: "script",
      referer_url: "script",
      ip: "127.0.0.1",
      invoice_id: commission.invoiceId || nanoid(16),
      amount: amount,
      currency: "usd",
      payment_processor: "stripe",
      metadata: JSON.stringify({
        manual: true,
        admin: "test-admin@example.com",
        notes: "Test manual sale created via script",
      }),
    };
    
    // Send event to Tinybird
    await recordSaleEvent(tinyBirdEvent);
    console.log(`Successfully recorded Tinybird event for manual sale: ${eventId}`);
  } catch (error) {
    console.error("Error recording Tinybird event:", error);
  }
  
  console.log("Manual sale successfully added!");
}

// Run the function
addManualSale()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 