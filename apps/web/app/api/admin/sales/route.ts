import { createId } from "@/lib/api/create-id";
import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { nanoid } from "@dub/utils";
import { CommissionStatus, EventType } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateProgramEarnings, calculateManualEarnings } from "@/lib/api/sales/calculate-sale-earnings";
import { recordSaleWithTimestamp } from "@/lib/tinybird/record-sale";
import { generateRandomName } from "@/lib/names";
import { OG_AVATAR_URL } from "@dub/utils";
import { createPartnerCommission } from "@/lib/partners/create-partner-commission";

// GET /api/admin/sales - Get manually recorded sales
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    // Get user ID from the email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    
    if (!user || !await isDubAdmin(user.id)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }
    
    const sales = await prisma.commission.findMany({
      where: {
        eventId: {
          startsWith: "manual_", // Identify manually created sales
        },
      },
      include: {
        link: {
          select: {
            key: true,
            url: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });
    
    // Transform the data for frontend
    const formattedSales = sales.map(sale => ({
      id: sale.id,
      linkId: sale.linkId,
      linkKey: sale.link.key,
      linkUrl: sale.link.url,
      amount: sale.amount,
      currency: sale.currency,
      status: sale.status,
      createdAt: sale.createdAt.toISOString(),
      userId: sale.link.user?.id || "",
      userEmail: sale.link.user?.email || "",
      partnerId: sale.partnerId,
      partnerName: sale.partner?.name || "",
      partnerEmail: sale.partner?.email || "",
      eventId: sale.eventId,
      invoiceId: sale.invoiceId,
    }));
    
    return NextResponse.json({ sales: formattedSales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Schema for the POST request
const recordSaleSchema = z.object({
  linkId: z.string(),
  amount: z.number().int().min(0),
  currency: z.string().default("usd"),
  paymentProcessor: z.string(),
  eventName: z.string().default("Manual Sale"),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
  customerId: z.string().optional(), // Optional customer ID to associate with the sale
  commissionAmount: z.number().int().min(0).optional(), // Optional commission amount for manual override
  userTakeRate: z.number().min(0).max(100).default(50).optional(), // Optional user take rate (renamed from commissionSplitPercentage)
});

// POST /api/admin/sales - Record a manual sale
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    // Get user ID from the email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    
    if (!user || !await isDubAdmin(user.id)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }
    
    const body = await req.json();
    const validatedData = recordSaleSchema.parse(body);
    
    // Get the link to determine the partner/user
    const link = await prisma.link.findUnique({
      where: {
        id: validatedData.linkId,
      },
      include: {
        project: true,
      },
    });
    
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    
    // Format the eventId to include the admin email, notes, and other data
    // This allows us to store additional information within the eventId itself
    // Format: manual_[random_id]_[admin_email]_[payment_processor]_[event_name]
    const adminInfo: {
      admin: string;
      date: string;
      notes: string;
      processor: string;
      event: string;
      commissionAmount?: number;
      userTakeRate?: number; // Renamed from commissionSplitPercentage
    } = {
      admin: session.user.email,
      date: new Date().toISOString(),
      notes: validatedData.notes || "",
      processor: validatedData.paymentProcessor,
      event: validatedData.eventName,
    };
    
    // Generate a unique event ID prefixed with "manual_" to identify admin-created sales
    // Store JSON data in the eventId truncated to stay below string length limits
    const eventId = `manual_${nanoid(10)}_${Buffer.from(JSON.stringify(adminInfo).slice(0, 100)).toString('base64')}`;
    
    // Calculate earnings based on provided commission data or program's commission structure
    let rawEarnings;
    let adjustedEarnings; // Earnings after applying userTakeRate
    let reward: any = null;

    // Make sure userTakeRate has a value by using the default from the schema
    const userTakeRate = validatedData.userTakeRate ?? 50;

    // Always store userTakeRate in metadata for reference
    adminInfo.userTakeRate = userTakeRate;

    if (validatedData.commissionAmount !== undefined && validatedData.userTakeRate !== undefined) {
      // Get raw earnings (commission amount)
      rawEarnings = validatedData.commissionAmount;
      
      // Apply userTakeRate to get the adjusted earnings
      adjustedEarnings = calculateManualEarnings({
        commissionAmount: validatedData.commissionAmount,
        splitPercentage: validatedData.userTakeRate // Use the exact value from form
      });
      
      // Store commission amount in metadata
      adminInfo.commissionAmount = validatedData.commissionAmount;
      
      // Create a custom reward object for commission splits
      reward = {
        id: 'manual',
        event: 'sale',
        type: 'flat',
        amount: validatedData.commissionAmount,
        programId: link.programId || '',
      };
    } else {
      // Use the default program-based calculation
      rawEarnings = await calculateProgramEarnings({
        programId: link.programId || null,
        amount: validatedData.amount,
        quantity: 1
      });
      
      // Apply the userTakeRate to the raw earnings
      adjustedEarnings = Math.floor(rawEarnings * (userTakeRate / 100));
    }

    // Get or create a customer record if customerId is not provided
    let customerId = validatedData.customerId;
    if (!customerId) {
      // Create a placeholder customer for this manual sale
      const placeholderName = `Manual Sale Customer ${nanoid(6)}`;
      
      // Make sure we have valid projectId
      const projectId = link.project?.id;
      if (!projectId) {
        return NextResponse.json({ error: "Unable to determine project ID" }, { status: 500 });
      }
      
      // Note: We don't set programId directly on the customer because the field doesn't exist in the database.
      // Instead, we handle it in the API validation layer, where we ensure the programId field is optional.
      const customer = await prisma.customer.create({
        data: {
          id: createId({ prefix: "cus_" }),
          name: placeholderName,
          externalId: `manual_sale_${nanoid(8)}`,
          projectId,
          linkId: link.id,
        },
      });
      customerId = customer.id;
    }

    // Create the commission record using createPartnerCommission which handles commission splits
    let commission;
    try {
      // Check if the link has commission splits
      console.log("Checking for commission splits in link:", link.id);
      console.log("Commission splits data:", (link as any).commissionSplits);
      
      // Use createPartnerCommission function which handles commission splits
      commission = await createPartnerCommission({
        reward,
        event: EventType.sale,
        programId: link.programId || "",
        partnerId: link.partnerId || "",
        linkId: link.id,
        customerId: customerId,
        eventId,
        invoiceId: validatedData.invoiceId || null,
        amount: validatedData.amount,
        quantity: 1,
        currency: validatedData.currency,
        calculatedEarnings: adjustedEarnings, // Use the earnings adjusted by userTakeRate
      });
      
      if (!commission) {
        // If createPartnerCommission returns null (e.g., no applicable reward), create a basic commission
        console.log("Creating basic commission as fallback");
        commission = await prisma.commission.create({
          data: {
            id: createId({ prefix: "cm_" }),
            programId: link.programId || "",
            partnerId: link.partnerId || "",
            linkId: link.id,
            customerId: customerId,
            eventId,
            type: EventType.sale,
            amount: validatedData.amount,
            quantity: 1,
            currency: validatedData.currency,
            status: CommissionStatus.pending,
            invoiceId: validatedData.invoiceId || null,
            earnings: adjustedEarnings,
          },
        });
      }
    } catch (commissionError) {
      console.error("Error creating commission with splits:", commissionError);
      // Fallback to basic commission creation if there's an error
      commission = await prisma.commission.create({
        data: {
          id: createId({ prefix: "cm_" }),
          programId: link.programId || "",
          partnerId: link.partnerId || "",
          linkId: link.id,
          customerId: customerId,
          eventId,
          type: EventType.sale,
          amount: validatedData.amount,
          quantity: 1,
          currency: validatedData.currency,
          status: CommissionStatus.pending,
          invoiceId: validatedData.invoiceId || null,
          earnings: adjustedEarnings,
        },
      });
    }
    
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
          increment: validatedData.amount,
        },
      },
    });
    
    // Update project usage statistics if available
    if (link.projectId) {
      await prisma.project.update({
        where: {
          id: link.projectId,
        },
        data: {
          salesUsage: {
            increment: validatedData.amount,
          },
        },
      });
    }

    // Create a Tinybird event record for this manual sale
    // This ensures it appears in the Events and Analytics pages
    // Using the format from the seed script as reference
    const tinyBirdEvent = {
      timestamp: new Date().toISOString(),
      event_id: eventId,
      event_name: validatedData.eventName,
      customer_id: customerId,
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
      referer: "admin",
      referer_url: "admin",
      ip: "127.0.0.1",
      invoice_id: validatedData.invoiceId || nanoid(16),
      amount: validatedData.amount,
      currency: validatedData.currency.toLowerCase(),
      payment_processor: validatedData.paymentProcessor,
      metadata: JSON.stringify({
        manual: true,
        admin: session.user.email,
        notes: validatedData.notes || "",
        commissionAmount: validatedData.commissionAmount,
        userTakeRate: validatedData.userTakeRate, // Renamed from commissionSplitPercentage
      }),
    };
    
    try {
      await recordSaleWithTimestamp(tinyBirdEvent);
      console.log("Successfully recorded Tinybird event for manual sale:", eventId);
    } catch (tinyBirdError) {
      // Log the error but don't fail the whole operation
      console.error("Error recording Tinybird event for manual sale:", tinyBirdError);
      console.error("Manual sale will be visible in the database but may not appear in Events/Analytics");
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Sale recorded successfully",
      commission,
    });
  } catch (error) {
    console.error("Error recording sale:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 