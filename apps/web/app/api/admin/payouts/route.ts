import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withAdmin } from "@/lib/auth";
import { sqlGranularityMap } from "@/lib/planetscale/granularity";
import { prisma } from "@dub/prisma";
import { ACME_WORKSPACE_ID } from "@dub/utils";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { createId } from "@/lib/api/create-id";
import { isDubAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth/options";
import { CommissionStatus, PayoutStatus } from "@dub/prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";

interface TimeseriesPoint {
  payouts: number;
  fees: number;
  total: number;
}

interface FormattedTimeseriesPoint extends TimeseriesPoint {
  date: Date;
}

export const GET = withAdmin(async ({ searchParams }) => {
  const { interval = "mtd", start, end, timezone = "UTC" } = searchParams;

  const { startDate, endDate, granularity } = getStartEndDates({
    interval,
    start,
    end,
  });

  // Fetch invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId: {
        not: ACME_WORKSPACE_ID,
      },
      status: "completed",
      paidAt: {
        not: null,
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      program: {
        select: {
          name: true,
          logo: true,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const { dateFormat, dateIncrement, startFunction, formatString } =
    sqlGranularityMap[granularity];

  // Calculate timeseries data for payouts and fees
  const timeseriesData = await prisma.$queryRaw<
    { date: Date; payouts: number; fees: number; total: number }[]
  >`
    SELECT 
      DATE_FORMAT(CONVERT_TZ(paidAt, "UTC", ${timezone}), ${dateFormat}) as date,
      SUM(amount) as payouts,
      SUM(fee) as fees,
      SUM(total) as total
    FROM Invoice
    WHERE 
      workspaceId != ${ACME_WORKSPACE_ID}
      AND status = 'completed'
      AND paidAt IS NOT NULL
      AND paidAt >= ${startDate}
      AND paidAt <= ${endDate}
    GROUP BY DATE_FORMAT(CONVERT_TZ(paidAt, "UTC", ${timezone}), ${dateFormat})
    ORDER BY date ASC;
  `;

  const formattedInvoices = invoices.map((invoice) => ({
    date: invoice.paidAt,
    programName: invoice.program.name,
    programLogo: invoice.program.logo,
    status: invoice.status,
    amount: invoice.amount,
    fee: invoice.fee,
    total: invoice.total,
  }));

  // Create a lookup object for the timeseries data
  const timeseriesLookup: Record<string, TimeseriesPoint> = Object.fromEntries(
    timeseriesData.map((item) => [
      item.date,
      {
        payouts: Number(item.payouts),
        fees: Number(item.fees),
        total: Number(item.total),
      },
    ]),
  );

  // Backfill missing dates with 0 values
  let currentDate = startFunction(
    DateTime.fromJSDate(startDate).setZone(timezone),
  );

  const formattedTimeseriesData: FormattedTimeseriesPoint[] = [];

  while (currentDate < endDate) {
    const periodKey = currentDate.toFormat(formatString);

    formattedTimeseriesData.push({
      date: currentDate.toJSDate(),
      ...(timeseriesLookup[periodKey] || {
        payouts: 0,
        fees: 0,
        total: 0,
      }),
    });

    currentDate = dateIncrement(currentDate);
  }

  return NextResponse.json({
    invoices: formattedInvoices,
    timeseriesData: formattedTimeseriesData,
  });
});

// Schema for creating a payout
const createPayoutSchema = z.object({
  partnerId: z.string(),
  commissionIds: z.array(z.string()).min(1),
  description: z.string().optional(),
  programId: z.string().optional(),
});

// POST /api/admin/payouts - Create a payout for commissions
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || !isDubAdmin(session.user.email)) {
    return new NextResponse("Unauthorized", { status: 403 });
  }
  
  try {
    const body = await req.json();
    const { partnerId, commissionIds, description, programId } = createPayoutSchema.parse(body);
    
    // Fetch all the commissions that will be part of this payout
    const commissions = await prisma.commission.findMany({
      where: {
        id: {
          in: commissionIds,
        },
        partnerId,
        status: CommissionStatus.pending,
        payoutId: null,
      },
    });
    
    // Calculate the total amount for the payout
    const totalAmount = commissions.reduce((sum, commission) => sum + commission.earnings, 0);
    
    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Cannot create a payout with zero or negative amount" },
        { status: 400 }
      );
    }
    
    // Get the first commission's program if programId is not specified
    const firstProgramId = programId || commissions[0]?.programId;
    
    if (!firstProgramId) {
      return NextResponse.json(
        { error: "No valid program ID could be determined" },
        { status: 400 }
      );
    }
    
    // Create the payout in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the payout
      const payout = await tx.payout.create({
        data: {
          id: createId({ prefix: "po_" }),
          programId: firstProgramId,
          partnerId,
          amount: totalAmount,
          currency: "usd", // Default currency
          status: PayoutStatus.pending,
          description: description || `Admin initiated payout by ${session?.user?.email}`,
          periodStart: new Date(), // Current date as period start
          periodEnd: new Date(), // Current date as period end
        },
      });
      
      // Update all commissions to be associated with this payout
      await tx.commission.updateMany({
        where: {
          id: {
            in: commissionIds,
          },
        },
        data: {
          status: CommissionStatus.processed,
          payoutId: payout.id,
        },
      });
      
      return payout;
    });
    
    return NextResponse.json({
      success: true,
      message: "Payout created successfully",
      payout: result,
    });
  } catch (error) {
    console.error("Error creating payout:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
