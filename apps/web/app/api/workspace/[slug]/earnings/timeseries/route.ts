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
  async ({ workspace, searchParams, session }) => {
    try {
      const { start, end, interval, timezone, groupBy, linkId, customerId, status, type } = querySchema.parse(searchParams);

      const { startDate, endDate, granularity } = getStartEndDates({
        interval,
        start,
        end,
      });

      const { dateFormat, dateIncrement, startFunction, formatString } =
        sqlGranularityMap[granularity];

      // Default partner filter (empty)
      let partnerFilter = Prisma.sql``;

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

          // Construct the partner filter SQL only if we have valid partner IDs
          if (partnerIds.length > 0) {
            partnerFilter = Prisma.sql`OR partnerId IN (${Prisma.join(partnerIds)})`;
          }
        } catch (partnerError) {
          console.error("Error fetching partner IDs:", partnerError);
          // Continue without partner filtering if there's an error
        }
      }

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
          AND (
            programId IN (
              SELECT id FROM Program WHERE workspaceId = ${workspace.id}
            )
            OR linkId IN (
              SELECT id FROM Link WHERE projectId = ${workspace.id}
            )
            ${partnerFilter}
          )
          AND createdAt >= ${startDate}
          AND createdAt < ${endDate}
          AND status NOT IN ('canceled', 'fraud', 'duplicate')
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
    } catch (error) {
      console.error("Error in earnings timeseries API:", error);
      return NextResponse.json(
        { error: "Failed to fetch earnings timeseries data" },
        { status: 500 }
      );
    }
  }
); 