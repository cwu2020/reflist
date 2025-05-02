import { getStartEndDates } from "@/lib/analytics/utils/get-start-end-dates";
import { withWorkspace } from "@/lib/auth";
import z from "@/lib/zod";
import { getWorkspaceEarningsQuerySchema } from "@/lib/zod/schemas/earnings";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";

// GET /api/workspace/[slug]/earnings - get earnings for a workspace
export const GET = withWorkspace(
  async ({ workspace, searchParams, session }) => {
    try {
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

      // Initialize with just workspace-related conditions
      const orConditions = [
        // Include commissions from programs belonging to this workspace
        // {
        //   program: {
        //     workspaceId: workspace.id,
        //   },
        // },
        // Include commissions from links directly created in this workspace
        {
          link: {
            projectId: workspace.id,
          },
        },
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
            orConditions.push({
              partnerId: {
                in: partnerIds
              }
            } as any); // Use type assertion to avoid TypeScript errors
          }
        } catch (partnerError) {
          console.error("Error fetching partner IDs:", partnerError);
          // Continue without partner filtering if there's an error
        }
      }

      const earnings = await prisma.commission.findMany({
        where: {
          earnings: {
            gt: 0,
          },
          OR: orConditions,
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
          partner: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      });

      return NextResponse.json(earnings);
    } catch (error) {
      console.error("Error in earnings API:", error);
      return NextResponse.json(
        { error: "Failed to fetch earnings data" },
        { status: 500 }
      );
    }
  }
); 