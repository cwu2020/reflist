import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { CommissionStatus } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

// Query schema for fetching commissions
const commissionsQuerySchema = z.object({
  status: z.enum([
    CommissionStatus.pending, 
    CommissionStatus.processed, 
    CommissionStatus.paid, 
    CommissionStatus.refunded,
    CommissionStatus.duplicate,
    CommissionStatus.fraud,
    CommissionStatus.canceled
  ]).default(CommissionStatus.pending),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// GET /api/admin/commissions - Get commissions for admin payout management
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    const url = new URL(req.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const { status, page, limit } = commissionsQuerySchema.parse(searchParams);
    
    // Fetch commissions with partner and link information
    const commissions = await prisma.commission.findMany({
      where: {
        status,
        // Only include non-zero earnings
        earnings: {
          gt: 0
        },
        // Exclude commissions already associated with a payout
        payoutId: null,
        // Focus on sales type commissions
        type: "sale"
      },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        link: {
          select: {
            id: true,
            key: true,
            url: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    // Format the data for the response
    const formattedCommissions = commissions.map(commission => ({
      id: commission.id,
      partnerId: commission.partnerId,
      partnerName: commission.partner.name,
      partnerEmail: commission.partner.email,
      programId: commission.programId,
      programName: commission.program.name,
      linkId: commission.linkId,
      linkKey: commission.link.key,
      amount: commission.amount,
      earnings: commission.earnings,
      currency: commission.currency,
      status: commission.status,
      createdAt: commission.createdAt.toISOString(),
    }));
    
    return NextResponse.json({
      commissions: formattedCommissions,
      count: await prisma.commission.count({
        where: {
          status,
          earnings: { gt: 0 },
          payoutId: null,
          type: "sale"
        },
      }),
    });
  } catch (error) {
    console.error("Error fetching commissions:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 