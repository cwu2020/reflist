import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withWorkspace } from "@/lib/auth";
import { getWorkspaceEarningsCountQuerySchema } from "@/lib/zod/schemas/earnings";
import { prisma } from "@dub/prisma";
import { CommissionStatus } from "@dub/prisma/client";
import { NextResponse } from "next/server";

// GET /api/workspace/[slug]/earnings/count - get earnings counts and totals
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const parsed = getWorkspaceEarningsCountQuerySchema.parse(searchParams);
    const { status, type, linkId, customerId, payoutId } = parsed;

    const { startDate, endDate } = getStartEndDates(parsed);

    const commissionsCount = await prisma.commission.groupBy({
      by: ["status"],
      where: {
        earnings: {
          gt: 0,
        },
        program: {
          workspaceId: workspace.id,
        },
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
        program: {
          workspaceId: workspace.id,
        },
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
        program: {
          workspaceId: workspace.id,
        },
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
        program: {
          workspaceId: workspace.id,
        },
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
  }
); 