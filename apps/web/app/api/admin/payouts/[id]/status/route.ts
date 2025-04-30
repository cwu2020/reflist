import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@dub/prisma";
import { CommissionStatus, PayoutStatus } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema for payout status update
const updatePayoutStatusSchema = z.object({
  status: z.enum([
    PayoutStatus.pending,
    PayoutStatus.processing,
    PayoutStatus.completed,
    PayoutStatus.failed,
    PayoutStatus.canceled
  ]),
  stripeTransferId: z.string().optional(),
});

// PATCH /api/admin/payouts/[id]/status - Update payout status
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
    const { status, stripeTransferId } = updatePayoutStatusSchema.parse(body);
    
    // Verify the payout exists
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: {
        commissions: true,
      },
    });
    
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    
    // Prepare update data
    const updateData: any = { status };
    
    // Add additional fields based on status
    if (status === PayoutStatus.completed) {
      updateData.paidAt = new Date();
    }
    
    if (stripeTransferId) {
      updateData.stripeTransferId = stripeTransferId;
    }
    
    // Update payout in a transaction along with related commissions
    const result = await prisma.$transaction(async (tx) => {
      // Update the payout status
      const updatedPayout = await tx.payout.update({
        where: { id },
        data: updateData,
      });
      
      // Update associated commissions based on payout status
      if (status === PayoutStatus.completed) {
        // Mark all commissions as paid when payout is completed
        await tx.commission.updateMany({
          where: {
            payoutId: id,
          },
          data: {
            status: CommissionStatus.paid,
          },
        });
      } else if (status === PayoutStatus.failed || status === PayoutStatus.canceled) {
        // Reset commissions to pending if payout fails or is canceled
        await tx.commission.updateMany({
          where: {
            payoutId: id,
          },
          data: {
            status: CommissionStatus.pending,
            payoutId: null,
          },
        });
      }
      
      return updatedPayout;
    });
    
    return NextResponse.json({
      success: true,
      message: `Payout status updated to ${status}`,
      payout: result,
    });
  } catch (error) {
    console.error("Error updating payout status:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 