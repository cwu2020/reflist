import { withWorkspace } from "@/lib/auth";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const payoutsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.enum(["createdAt", "amount", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// GET /api/workspace/[slug]/payouts - get payouts for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { page, pageSize, sortBy, sortOrder } = payoutsQuerySchema.parse(searchParams);

    const payouts = await prisma.payout.findMany({
      where: {
        program: {
          workspaceId: workspace.id,
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
    });

    const count = await prisma.payout.count({
      where: {
        program: {
          workspaceId: workspace.id,
        },
      },
    });

    return NextResponse.json({
      payouts,
      count,
    });
  }
); 