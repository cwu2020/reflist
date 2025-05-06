import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { recordCommissionDeleted } from "@/lib/tinybird/record-commission-deleted";
import { prisma } from "@dub/prisma";
import { CommissionStatus } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// Helper function to determine if a status is valid (should count towards stats)
function isValidStatus(status: CommissionStatus): boolean {
  const invalidStatuses: CommissionStatus[] = [
    CommissionStatus.duplicate,
    CommissionStatus.fraud,
    CommissionStatus.canceled,
    CommissionStatus.refunded
  ];
  return !invalidStatuses.includes(status);
}

// DELETE /api/admin/commissions/[id] - Permanently delete a commission
export async function DELETE(
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
    
    // Verify the commission exists - handle potential null references
    try {
      const commission = await prisma.commission.findUnique({
        where: { id },
        include: {
          payout: true,
          link: {
            include: {
              // Include project to avoid null reference issues
              project: true
            }
          },
          program: true,
        },
      });
      
      if (!commission) {
        return NextResponse.json({ error: "Commission not found" }, { status: 404 });
      }
      
      // Check for required relationships - if program is null, that's an error condition
      if (!commission.program) {
        return NextResponse.json({ error: "Commission has invalid program reference" }, { status: 400 });
      }
      
      if (!commission.link) {
        return NextResponse.json({ error: "Commission has invalid link reference" }, { status: 400 });
      }
      
      // If it's already paid, don't allow deletion
      if (commission.status === CommissionStatus.paid) {
        return NextResponse.json(
          { error: "Cannot delete a paid commission" },
          { status: 400 }
        );
      }
      
      // If there's a payout associated with this commission, prevent deletion
      if (commission.payoutId) {
        return NextResponse.json(
          { error: "Cannot delete a commission that is part of a payout. Please remove it from the payout first." },
          { status: 400 }
        );
      }
      
      // Log deletion for audit purposes
      console.log(`ADMIN_AUDIT: User ${session.user.email} (${user.id}) deleted commission ${id}`, {
        commissionId: commission.id,
        programId: commission.programId,
        partnerId: commission.partnerId,
        linkId: commission.linkId,
        amount: commission.amount,
        earnings: commission.earnings,
        status: commission.status,
      });
      
      // Begin transaction to ensure all updates happen atomically
      const result = await prisma.$transaction(async (tx) => {
        // Only update link statistics if the commission status was valid
        if (commission.link && isValidStatus(commission.status)) {
          // Commission was valid - decrement stats
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
          
          console.log(`Decremented link stats for deleted commission ${id}`);
        }
        
        // Delete the commission
        const deletedCommission = await tx.commission.delete({
          where: { id },
        });
        
        return {
          success: true,
          deletedCommission
        };
      });
      
      // Send a Tinybird event for the deletion
      try {
        await recordCommissionDeleted({
          commission_id: commission.id,
          link_id: commission.linkId,
          program_id: commission.programId,
          partner_id: commission.partnerId,
          customer_id: commission.customerId || null,
          amount: commission.amount,
          earnings: commission.earnings,
          admin_id: user.id,
          admin_email: session.user.email,
          reason: "Manual deletion by admin",
        });
        console.log(`Sent Tinybird event for commission deletion: ${id}`);
      } catch (tbError) {
        // Don't fail the request if Tinybird recording fails
        console.error("Failed to record Tinybird event for commission deletion:", tbError);
      }
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: `Commission ${id} has been permanently deleted`,
        stats: {
          linkUpdated: isValidStatus(commission.status),
          amountRemoved: commission.amount,
        },
      });
      
    } catch (dbError) {
      console.error("Database error when finding or deleting commission:", dbError);
      return NextResponse.json({
        error: "Failed to process commission deletion due to database error",
        details: dbError instanceof Error ? dbError.message : "Unknown database error"
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Error deleting commission:", error);
    return new NextResponse(`Internal Server Error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
} 