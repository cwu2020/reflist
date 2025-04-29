import { withWorkspace } from "@/lib/auth";
import { prisma } from "@dub/prisma";
import { PayoutStatus } from "@dub/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const withdrawSchema = z.object({
  amount: z.number().positive(),
  // Optional fields for additional withdrawal details
  description: z.string().optional(),
  programId: z.string().optional(), // If the withdrawal is associated with a specific program
});

// POST /api/workspace/[slug]/withdraw - initiate a withdrawal for a workspace
export const POST = withWorkspace(
  async ({ workspace, req }) => {
    const body = await req.json();
    const { amount, description, programId } = withdrawSchema.parse(body);
    
    // Get available balance
    const availableBalance = await prisma.commission.aggregate({
      where: {
        earnings: {
          gt: 0,
        },
        program: {
          workspaceId: workspace.id,
        },
        status: "processed",
        payoutId: null,
        ...(programId && { programId }),
      },
      _sum: {
        earnings: true,
      },
    });
    
    const availableAmount = availableBalance._sum.earnings || 0;
    
    if (amount > availableAmount) {
      return new Response(
        JSON.stringify({
          error: "Withdrawal amount exceeds available balance",
          availableAmount,
        }),
        { status: 400 }
      );
    }
    
    // Get the program ID
    const programIdToUse = programId || await getDefaultProgramId(workspace.id);
    
    // Get a default partner or create one if needed
    const partnerId = await getOrCreateDefaultPartner(workspace.id, programIdToUse);
    
    // Create a new payout
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const payout = await prisma.payout.create({
      data: {
        amount,
        currency: "USD",
        status: PayoutStatus.pending,
        periodStart: firstDayOfMonth,
        periodEnd: lastDayOfMonth,
        description: description || `Withdrawal initiated on ${now.toLocaleDateString()}`,
        program: {
          connect: {
            id: programIdToUse,
          },
        },
        partner: {
          connect: {
            id: partnerId,
          },
        },
      },
    });
    
    // Update commissions with the new payout ID
    // This marks the funds as allocated to this payout
    await prisma.commission.updateMany({
      where: {
        earnings: {
          gt: 0,
        },
        program: {
          workspaceId: workspace.id,
        },
        status: "processed",
        payoutId: null,
        ...(programId && { programId }),
      },
      data: {
        payoutId: payout.id,
      },
    });
    
    return NextResponse.json({
      success: true,
      payout,
    });
  }
);

// Helper function to get the default program ID for a workspace
async function getDefaultProgramId(workspaceId: string): Promise<string> {
  const program = await prisma.program.findFirst({
    where: {
      workspaceId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  
  if (!program) {
    throw new Error("No program found for this workspace");
  }
  
  return program.id;
}

// Helper function to get or create a default partner for a program
async function getOrCreateDefaultPartner(workspaceId: string, programId: string): Promise<string> {
  // Look for an existing partner enrollment for this program
  const programEnrollment = await prisma.programEnrollment.findFirst({
    where: {
      programId,
      status: "approved",
    },
    include: {
      partner: true,
    },
  });
  
  if (programEnrollment?.partner) {
    return programEnrollment.partner.id;
  }
  
  // If no partner exists, create a default system partner
  const partner = await prisma.partner.create({
    data: {
      name: "System Partner",
      email: `system-partner-${workspaceId}@system.thereflist.com`,
    },
  });
  
  // Create a program enrollment for this partner
  await prisma.programEnrollment.create({
    data: {
      status: "approved",
      program: {
        connect: {
          id: programId,
        },
      },
      partner: {
        connect: {
          id: partner.id,
        },
      },
    },
  });
  
  return partner.id;
} 