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

// Helper function to determine if a status should not count towards Link stats
function isInvalidStatus(status: CommissionStatus): boolean {
  const invalidStatuses: CommissionStatus[] = [
    CommissionStatus.duplicate,
    CommissionStatus.fraud,
    CommissionStatus.canceled,
    CommissionStatus.refunded
  ];
  return invalidStatuses.includes(status);
}

// PATCH /api/admin/commissions/[id]/status - Update commission status
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    
    const { id } = params;
    const body = await req.json();
    const { status } = updateStatusSchema.parse(body);
    
    // Verify the commission exists
    const commission = await prisma.commission.findUnique({
      where: { id },
      include: {
        payout: true,
        link: true,
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
    
    // Check if we need to update the link stats
    const wasValidBefore = !isInvalidStatus(commission.status);
    const isValidNow = !isInvalidStatus(status);
    
    // Begin transaction to ensure Link stats and Commission status are updated atomically
    const result = await prisma.$transaction(async (tx) => {
      // Update the commission status
      const updatedCommission = await tx.commission.update({
        where: { id },
        data: {
          status,
          // If marking as duplicate or fraud, remove from any payout
          payoutId: status !== CommissionStatus.pending ? null : commission.payoutId,
        },
      });
      
      // Update link statistics if needed
      if (commission.link && wasValidBefore !== isValidNow) {
        if (wasValidBefore && !isValidNow) {
          // Commission was valid but is now invalid - decrement stats
          await tx.link.update({
            where: { id: commission.linkId },
            data: {
              sales: {
                decrement: 1,
              },
              saleAmount: {
                decrement: commission.amount,
              },
            },
          });
          
          // If available, update project stats too
          if (commission.link.projectId) {
            await tx.project.update({
              where: { id: commission.link.projectId },
              data: {
                salesUsage: {
                  decrement: commission.amount,
                },
              },
            });
          }
          
          console.log(`Decremented link stats for invalidated commission ${id}`);
        } else if (!wasValidBefore && isValidNow) {
          // Commission was invalid but is now valid - increment stats
          await tx.link.update({
            where: { id: commission.linkId },
            data: {
              sales: {
                increment: 1,
              },
              saleAmount: {
                increment: commission.amount,
              },
            },
          });
          
          // If available, update project stats too
          if (commission.link.projectId) {
            await tx.project.update({
              where: { id: commission.link.projectId },
              data: {
                salesUsage: {
                  increment: commission.amount,
                },
              },
            });
          }
          
          console.log(`Incremented link stats for validated commission ${id}`);
        }
      }
      
      return updatedCommission;
    });
    
    return NextResponse.json({
      success: true,
      message: `Status updated to ${status}`,
      commission: result,
    });
  } catch (error) {
    console.error("Error updating commission status:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 