import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withWorkspace } from "@/lib/auth";
import { getWorkspaceEarningsCountQuerySchema } from "@/lib/zod/schemas/earnings";
import { prisma } from "@dub/prisma";
import { CommissionStatus } from "@dub/prisma/client";
import { NextResponse } from "next/server";

// GET /api/workspace/[slug]/earnings/count - get earnings counts and totals
export const GET = withWorkspace(
  async ({ workspace, searchParams, session }) => {
    try {
      const parsed = getWorkspaceEarningsCountQuerySchema.parse(searchParams);
      const { status, type, linkId, customerId, payoutId } = parsed;

      const { startDate, endDate } = getStartEndDates(parsed);

      // Initialize base OR conditions
      const baseOrCondition = [
        // Include commissions from programs belonging to this workspace
        {
          program: {
            workspaceId: workspace.id,
          },
        },
        // Include commissions from links directly created in this workspace
        {
          link: {
            projectId: workspace.id,
          },
        }
      ];

      // Only attempt to add partner conditions if we have a user session
      if (session?.user?.id) {
        try {
          // Get the user's partner IDs
          const userPartnerId = session?.user?.defaultPartnerId as string | undefined;
          const partnerIds: string[] = [];
          
          if (userPartnerId) {
            partnerIds.push(userPartnerId);
          }
          
          // If user has multiple partners, fetch all of them
          const userPartners = await prisma.partnerUser.findMany({
            where: { userId: session.user.id },
            select: { partnerId: true }
          });
          
          // Add all partner IDs to the array, removing duplicates
          userPartners.forEach(p => {
            if (p.partnerId && !partnerIds.includes(p.partnerId)) {
              partnerIds.push(p.partnerId);
            }
          });

          // Only add the partner condition if we found valid partner IDs
          if (partnerIds.length > 0) {
            baseOrCondition.push({
              partnerId: {
                in: partnerIds
              }
            } as any);
          }
        } catch (partnerError) {
          console.error("Error fetching partner IDs:", partnerError);
          // Continue without partner filtering if there's an error
        }
      }

      const commissionsCount = await prisma.commission.groupBy({
        by: ["status"],
        where: {
          earnings: {
            gt: 0,
          },
          OR: baseOrCondition,
          status,
          type,
          linkId,
          customerId,
          payoutId,
          createdAt: {
            gte: startDate.toISOString(),
            lte: endDate.toISOString(),
          },
        },
        _count: true,
        _sum: {
          amount: true,
          earnings: true,
        },
      });

      const counts = commissionsCount.reduce(
        (acc, p) => {
          acc[p.status] = {
            count: p._count,
            amount: p._sum.amount ?? 0,
            earnings: p._sum.earnings ?? 0,
          };
          return acc;
        },
        {} as Record<
          CommissionStatus | "all",
          {
            count: number;
            amount: number;
            earnings: number;
          }
        >,
      );

      // fill in missing statuses with 0
      Object.values(CommissionStatus).forEach((status) => {
        if (!(status in counts)) {
          counts[status] = {
            count: 0,
            amount: 0,
            earnings: 0,
          };
        }
      });

      counts.all = commissionsCount.reduce(
        (acc, p) => ({
          count: acc.count + p._count,
          amount: acc.amount + (p._sum.amount ?? 0),
          earnings: acc.earnings + (p._sum.earnings ?? 0),
        }),
        { count: 0, amount: 0, earnings: 0 },
      );

      // Also get earnings for current month for the wallet display
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthlyEarnings = await prisma.commission.aggregate({
        where: {
          earnings: {
            gt: 0,
          },
          OR: baseOrCondition,
          status: {
            in: ["pending", "processed", "paid"],
          },
          createdAt: {
            gte: firstDayOfMonth.toISOString(),
            lte: lastDayOfMonth.toISOString(),
          },
        },
        _sum: {
          earnings: true,
        },
      });

      // Get available balance (processed but not paid)
      const availableBalance = await prisma.commission.aggregate({
        where: {
          earnings: {
            gt: 0,
          },
          OR: baseOrCondition,
          status: "processed",
          payoutId: null,
        },
        _sum: {
          earnings: true,
        },
      });

      // Get pending earnings
      const pendingEarnings = await prisma.commission.aggregate({
        where: {
          earnings: {
            gt: 0,
          },
          OR: baseOrCondition,
          status: "pending",
        },
        _sum: {
          earnings: true,
        },
      });

      return NextResponse.json({
        counts,
        monthlyEarnings: monthlyEarnings._sum.earnings || 0,
        availableBalance: availableBalance._sum.earnings || 0,
        pendingEarnings: pendingEarnings._sum.earnings || 0,
      });
    } catch (error) {
      console.error("Error in earnings count API:", error);
      return NextResponse.json(
        { error: "Failed to fetch earnings count data" },
        { status: 500 }
      );
    }
  }
); 