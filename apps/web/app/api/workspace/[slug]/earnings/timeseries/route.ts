import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withWorkspace } from "@/lib/auth";
import { sqlGranularityMap } from "@/lib/planetscale/granularity";
import { prisma } from "@dub/prisma";
import { Prisma } from "@dub/prisma/client";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define a completely independent query schema for the timeseries endpoint
const querySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  interval: z.string().optional(),
  timezone: z.string().optional(),
  groupBy: z.enum(["linkId", "type"]).optional(),
  linkId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

interface CommissionTimeseries {
  start: string;
  earnings: number;
  groupBy?: string;
  data?: Record<string, number>;
}

// GET /api/workspace/[slug]/earnings/timeseries - get earnings timeseries for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams }) => {
    const { start, end, interval, timezone, groupBy, linkId, customerId, status, type } = querySchema.parse(searchParams);

    const { startDate, endDate, granularity } = getStartEndDates({
      interval,
      start,
      end,
    });

    const { dateFormat, dateIncrement, startFunction, formatString } =
      sqlGranularityMap[granularity];

    const earnings = await prisma.$queryRaw<
      {
        start: string;
        earnings: number;
        [key: string]: any;
      }[]
    >`
      SELECT 
        DATE_FORMAT(CONVERT_TZ(createdAt, "UTC", ${timezone || "UTC"}), ${dateFormat}) AS start, 
        ${groupBy ? (groupBy === "type" ? Prisma.sql`type,` : Prisma.sql`linkId,`) : Prisma.sql``}
        SUM(earnings) AS earnings
      FROM Commission
      WHERE 
        earnings > 0
        AND programId IN (
          SELECT id FROM Program WHERE workspaceId = ${workspace.id}
        )
        AND createdAt >= ${startDate}
        AND createdAt < ${endDate}
        ${type ? Prisma.sql`AND type = ${type}` : Prisma.sql``}
        ${status ? Prisma.sql`AND status = ${status}` : Prisma.sql``}
        ${linkId ? Prisma.sql`AND linkId = ${linkId}` : Prisma.sql``}
        ${customerId ? Prisma.sql`AND customerId = ${customerId}` : Prisma.sql``}
        GROUP BY start${groupBy ? (groupBy === "type" ? Prisma.sql`, type` : Prisma.sql`, linkId`) : Prisma.sql``}
      ORDER BY start ASC;
    `;

    let currentDate = startFunction(
      DateTime.fromJSDate(startDate).setZone(timezone || "UTC"),
    );

    const timeseries: CommissionTimeseries[] = [];
    const dataLookup: Record<string, Record<string, number>> = {};

    // Process the raw data into the format we need
    if (groupBy) {
      // Handle grouped data
      for (const item of earnings) {
        const startKey = item.start;
        const groupKey = item[groupBy];
        const earnings = Number(item.earnings);

        if (!dataLookup[startKey]) {
          dataLookup[startKey] = { earnings: 0 };
        }

        dataLookup[startKey][groupKey] = earnings;
        dataLookup[startKey].earnings += earnings;
      }
    } else {
      // Handle ungrouped data
      for (const item of earnings) {
        dataLookup[item.start] = { 
          earnings: Number(item.earnings) 
        };
      }
    }

    // Generate timeseries with all dates
    while (currentDate < endDate) {
      const periodKey = currentDate.toFormat(formatString);
      const entry = dataLookup[periodKey] || { earnings: 0 };

      timeseries.push({
        start: currentDate.toISO(),
        earnings: entry.earnings,
        ...(groupBy && { data: entry }),
      });

      currentDate = dateIncrement(currentDate);
    }

    return NextResponse.json(timeseries);
  }
); 