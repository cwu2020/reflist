import { NextResponse } from "next/server";
import { prisma } from "@dub/prisma";

// Define a type for commission data
interface CommissionSplit {
  id: string;
  earnings: number;
  createdAt?: Date;
  date?: Date;
  [key: string]: any; // Allow for any other properties
}

export async function POST(req: Request) {
  try {
    const { phoneNumber, partnerId } = await req.json();

    if (!phoneNumber || !partnerId) {
      return NextResponse.json(
        { error: "Phone number and partner ID are required" },
        { status: 400 }
      );
    }

    console.log(`Debug claim request for phone: ${phoneNumber}, partner: ${partnerId}`);

    // Get unclaimed commissions for this phone number
    let unclaimedCommissions: CommissionSplit[] = [];
    let claimedCommissions: CommissionSplit[] = [];
    let success = false;

    try {
      // Check if there are unclaimed commissions
      const splitsQuery = await prisma.$queryRaw`
        SELECT s.id, s.earnings, s.\`createdAt\` as date
        FROM \`CommissionSplit\` s
        WHERE s.\`phoneNumber\` = ${phoneNumber} AND s.claimed = false
      `;
      
      unclaimedCommissions = Array.isArray(splitsQuery) ? splitsQuery as CommissionSplit[] : [];
      console.log(`Found ${unclaimedCommissions.length} unclaimed commissions for ${phoneNumber}`);

      if (unclaimedCommissions.length > 0) {
        // Claim the commissions using raw queries
        await prisma.$transaction(async (tx) => {
          console.log(`Starting direct commission claim for ${phoneNumber} with partner ${partnerId}`);
          
          for (const commission of unclaimedCommissions) {
            await tx.$executeRaw`
              UPDATE \`CommissionSplit\` 
              SET claimed = true, 
                  \`claimedAt\` = NOW(), 
                  \`claimedById\` = ${partnerId},
                  \`partnerId\` = ${partnerId}
              WHERE id = ${commission.id}
            `;
            
            console.log(`Marked commission split ${commission.id} as claimed by partner ${partnerId}`);
          }
        });
        
        // Verify the claim worked
        const verifyQuery = await prisma.$queryRaw`
          SELECT * FROM \`CommissionSplit\` 
          WHERE \`phoneNumber\` = ${phoneNumber} AND claimed = true
        `;
        
        claimedCommissions = Array.isArray(verifyQuery) ? verifyQuery as CommissionSplit[] : [];
        
        if (claimedCommissions.length > 0) {
          success = true;
          console.log(`Successfully claimed ${claimedCommissions.length} commissions for phone ${phoneNumber}`);
        } else {
          console.log("No commissions were claimed despite the update query");
        }
      }
    } catch (error: any) {
      console.error("Error claiming commissions:", error);
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message || "Unknown error"}`,
        details: error
      }, { status: 500 });
    }

    return NextResponse.json({
      success,
      phoneNumber,
      partnerId,
      claimedCount: claimedCommissions.length,
      originalUnclaimedCount: unclaimedCommissions.length,
      claimedCommissions
    });
  } catch (error: any) {
    console.error("Debug claim error:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message || "Unknown error"}` },
      { status: 500 }
    );
  }
} 