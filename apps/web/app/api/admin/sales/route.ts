import { createId } from "@/lib/api/create-id";
import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { nanoid } from "@dub/utils";
import { CommissionStatus, EventType } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateProgramEarnings } from "@/lib/api/sales/calculate-sale-earnings";

// GET /api/admin/sales - Get manually recorded sales
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
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
});

// POST /api/admin/sales - Record a manual sale
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
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
    const adminInfo = {
      admin: session.user.email,
      date: new Date().toISOString(),
      notes: validatedData.notes || "",
      processor: validatedData.paymentProcessor,
      event: validatedData.eventName,
    };
    
    // Generate a unique event ID prefixed with "manual_" to identify admin-created sales
    // Store JSON data in the eventId truncated to stay below string length limits
    const eventId = `manual_${nanoid(10)}_${Buffer.from(JSON.stringify(adminInfo).slice(0, 100)).toString('base64')}`;
    
    // Calculate earnings based on program's commission structure
    const earnings = await calculateProgramEarnings({
      programId: link.programId || null,
      amount: validatedData.amount,
      quantity: 1
    });

    // Create the commission record
    const commission = await prisma.commission.create({
      data: {
        id: createId({ prefix: "cm_" }),
        programId: link.programId || "",
        partnerId: link.partnerId || "",
        linkId: link.id,
        eventId,
        type: EventType.sale,
        amount: validatedData.amount,
        quantity: 1,
        currency: validatedData.currency,
        status: CommissionStatus.pending,
        invoiceId: validatedData.invoiceId || null,
        earnings: earnings,
      },
    });
    
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