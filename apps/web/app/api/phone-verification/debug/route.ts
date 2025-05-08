import { NextResponse } from "next/server";
import { prisma } from "@dub/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function GET(req: Request) {
  try {
    // Ensure this endpoint is only accessible to authenticated users
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const phoneNumber = url.searchParams.get("phoneNumber");
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Get commission split status for the specified phone number
    const commissionSplits = await prisma.$queryRaw`
      SELECT s.id, s.claimed, s.\`claimedAt\`, s.\`claimedById\`, s.\`partnerId\`, s.earnings
      FROM \`CommissionSplit\` s
      WHERE s.\`phoneNumber\` = ${phoneNumber}
    `;
    
    // Get partner-user associations for the current user
    const userId = (session.user as any).id;
    const partnerUsers = await prisma.partnerUser.findMany({
      where: {
        userId: userId
      },
      include: {
        partner: true
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        commissionSplits: Array.isArray(commissionSplits) ? commissionSplits : [],
        partnerUsers,
        userId
      }
    });
  } catch (error: any) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      { error: "Failed to retrieve debug information" },
      { status: 500 }
    );
  }
} 