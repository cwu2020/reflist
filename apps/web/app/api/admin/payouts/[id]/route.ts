import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// GET /api/admin/payouts/[id] - Get payout details including associated commissions
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    const { id } = params;
    
    // Fetch the payout with related data
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    
    // Fetch associated commissions
    const commissions = await prisma.commission.findMany({
      where: {
        payoutId: id,
      },
      include: {
        link: {
          select: {
            id: true,
            key: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    // Format the data for the response
    const formattedPayout = {
      id: payout.id,
      partnerId: payout.partnerId,
      partnerName: payout.partner.name,
      partnerEmail: payout.partner.email,
      programId: payout.programId,
      programName: payout.program.name,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      description: payout.description,
      createdAt: payout.createdAt.toISOString(),
      paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
      stripeTransferId: payout.stripeTransferId,
    };
    
    const formattedCommissions = commissions.map(commission => ({
      id: commission.id,
      amount: commission.amount,
      earnings: commission.earnings,
      currency: commission.currency,
      status: commission.status,
      createdAt: commission.createdAt.toISOString(),
      linkId: commission.linkId,
      linkKey: commission.link.key,
    }));
    
    return NextResponse.json({
      payout: formattedPayout,
      commissions: formattedCommissions,
    });
  } catch (error) {
    console.error("Error fetching payout details:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 