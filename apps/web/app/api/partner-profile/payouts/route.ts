import { withPartnerProfile } from "@/lib/auth/partner";
import {
  PartnerPayoutResponseSchema,
  payoutsQuerySchema,
} from "@/lib/zod/schemas/payouts";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";
import z from "zod";

// GET /api/partner-profile/payouts - get all payouts for a partner
export const GET = withPartnerProfile(async ({ partner, searchParams }) => {
  const { programId, status, sortBy, sortOrder, page, pageSize } =
    payoutsQuerySchema.parse(searchParams);

  const payouts = await prisma.payout.findMany({
    where: {
      partnerId: partner.id,
      ...(programId && { programId }),
      ...(status && { status }),
    },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
      periodStart: true,
      periodEnd: true,
      quantity: true,
      createdAt: true,
      paidAt: true,
      program: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          minPayoutAmount: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  return NextResponse.json(z.array(PartnerPayoutResponseSchema).parse(payouts));
});
