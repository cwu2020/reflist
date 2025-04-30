import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { CommissionStatus } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema for status update
const updateStatusSchema = z.object({
  status: z.enum([
    CommissionStatus.pending,
    CommissionStatus.processed,
    CommissionStatus.paid, 
    CommissionStatus.refunded,
    CommissionStatus.duplicate,
    CommissionStatus.fraud,
    CommissionStatus.canceled
  ])
});

// PATCH /api/admin/commissions/[id]/status - Update commission status
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    const { id } = params;
    const body = await req.json();
    const { status } = updateStatusSchema.parse(body);
    
    // Verify the commission exists
    const commission = await prisma.commission.findUnique({
      where: { id },
      include: {
        payout: true,
      },
    });
    
    if (!commission) {
      return NextResponse.json({ error: "Commission not found" }, { status: 404 });
    }
    
    // If it's already paid, don't allow status changes
    if (commission.status === CommissionStatus.paid) {
      return NextResponse.json(
        { error: "Cannot change the status of a paid commission" },
        { status: 400 }
      );
    }
    
    // If there's a payout associated with this commission, handle it
    if (commission.payout && status !== CommissionStatus.pending) {
      // Update the payout amount to exclude this commission
      await prisma.payout.update({
        where: { id: commission.payoutId as string },
        data: {
          amount: {
            decrement: commission.earnings,
          },
        },
      });
    }
    
    // Update the commission status
    const updatedCommission = await prisma.commission.update({
      where: { id },
      data: {
        status,
        // If marking as duplicate or fraud, remove from any payout
        payoutId: status !== CommissionStatus.pending ? null : commission.payoutId,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: `Status updated to ${status}`,
      commission: updatedCommission,
    });
  } catch (error) {
    console.error("Error updating commission status:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 