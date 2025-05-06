import { withWorkspace } from "@/lib/auth";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

// Define the query schema for getting link stats
const linkStatsQuerySchema = z.object({
  domain: z.string(),
  key: z.string(),
});

// GET /api/links/stats - Get the latest stats for a specific link
export const GET = withWorkspace(
  async ({ searchParams, workspace }) => {
    try {
      const { domain, key } = linkStatsQuerySchema.parse(searchParams);
      
      // Fetch link with the latest stats directly from the database
      const link = await prisma.link.findUnique({
        where: {
          domain_key: {
            domain,
            key,
          },
          projectId: workspace.id,
        },
        select: {
          id: true,
          clicks: true,
          leads: true,
          sales: true,
          saleAmount: true,
          lastClicked: true,
        },
      });
      
      if (!link) {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
      }
      
      // Return just the stats to minimize response size
      return NextResponse.json({
        clicks: link.clicks,
        leads: link.leads,
        sales: link.sales,
        saleAmount: link.saleAmount,
        lastClicked: link.lastClicked,
      });
    } catch (error) {
      console.error("Error fetching link stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch link stats" },
        { status: 500 }
      );
    }
  },
  {
    requiredPermissions: ["links.read"],
  }
); 