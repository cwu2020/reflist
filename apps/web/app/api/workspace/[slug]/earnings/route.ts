import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withWorkspace } from "@/lib/auth";
import z from "@/lib/zod";
import { getWorkspaceEarningsQuerySchema } from "@/lib/zod/schemas/earnings";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";

// GET /api/workspace/[slug]/earnings - get earnings for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const {
      page,
      pageSize,
      type,
      status,
      sortBy,
      sortOrder,
      linkId,
      customerId,
      payoutId,
      interval,
      start,
      end,
    } = getWorkspaceEarningsQuerySchema.parse(searchParams);

    const { startDate, endDate } = getStartEndDates({
      interval,
      start,
      end,
    });

    const earnings = await prisma.commission.findMany({
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
      include: {
        customer: true,
        link: {
          select: {
            id: true,
            shortLink: true,
            url: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
    });

    return NextResponse.json(earnings);
  }
); 