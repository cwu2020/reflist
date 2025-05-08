import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPhoneNumber } from "@/lib/verification/phone-verification";
import { prisma } from "@dub/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

// Rate limiting - 10 attempts per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

// Define the interface for the commission data
interface CommissionData {
  id: string;
  earnings: number;
  date: Date;
}

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(10, ip); // 10 requests per minute per IP
    
    const { phoneNumber, code, doClaim = false } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and verification code are required" },
        { status: 400 }
      );
    }

    // Only verify the code if it's not a special claim code
    let verificationResult = { success: true, message: "Verification bypassed for claiming" };
    
    if (code !== "CLAIM_COMMISSIONS") {
      // Normal verification
      verificationResult = await verifyPhoneNumber(phoneNumber, code);

      if (!verificationResult.success) {
        console.error(`Verification failed for ${phoneNumber}: ${verificationResult.message}`);
        return NextResponse.json(
          { error: verificationResult.message },
          { status: 400 }
        );
      }
    }

    // Check if user is logged in (needed for claiming)
    let session;
    let userId;
    let userDefaultPartnerId;
    let userLoggedIn = false;

    try {
      session = await getServerSession(authOptions);
      const user = session?.user as { id?: string; defaultPartnerId?: string } | undefined;
      userId = user?.id;
      userDefaultPartnerId = user?.defaultPartnerId;
      userLoggedIn = !!userId;
      
      if (userLoggedIn) {
        console.log(`User authenticated: ${userId}, defaultPartnerId: ${userDefaultPartnerId || 'none'}`);
      } else if (doClaim || code === "CLAIM_COMMISSIONS") {
        console.log('No authenticated user found in session, but claim was requested');
        return NextResponse.json(
          { error: "Authentication required for claiming. Please sign in first." },
          { status: 401 }
        );
      }
    } catch (sessionError) {
      console.error("Error retrieving user session:", sessionError);
      // Handle session error - if claiming was requested, return auth error
      if (doClaim || code === "CLAIM_COMMISSIONS") {
        return NextResponse.json(
          { error: "Authentication error. Please sign in again to claim commissions." },
          { status: 401 }
        );
      }
    }

    // Get unclaimed commissions for this phone number
    let unclaimedCommissions: any[] = [];
    let claimedCommissions: any[] = [];
    let claimedAny = false;
    
    // Fetch unclaimed commissions
    try {
      // Using raw query to get commission splits
      const splitsQuery = await prisma.$queryRaw`
        SELECT s.id, s.earnings, s.\`createdAt\` as date
        FROM \`CommissionSplit\` s
        WHERE s.\`phoneNumber\` = ${phoneNumber} AND s.claimed = false
      `;
      
      unclaimedCommissions = Array.isArray(splitsQuery) ? splitsQuery : [];
      console.log(`Found ${unclaimedCommissions.length} unclaimed commissions for ${phoneNumber}`);
      
      // If claiming is requested and user is logged in, claim the commissions
      if ((doClaim || code === "CLAIM_COMMISSIONS") && userLoggedIn && userId && userDefaultPartnerId) {
        if (unclaimedCommissions.length > 0) {
          try {
            // Claim the commissions in a transaction
            await prisma.$transaction(async (tx) => {
              console.log(`Starting commission claim transaction for user ${userId} with partner ${userDefaultPartnerId}`);
              
              for (const commission of unclaimedCommissions) {
                await tx.$executeRaw`
                  UPDATE \`CommissionSplit\` 
                  SET claimed = true, 
                      \`claimedAt\` = NOW(), 
                      \`claimedById\` = ${userDefaultPartnerId},
                      \`partnerId\` = ${userDefaultPartnerId}
                  WHERE id = ${commission.id}
                `;
                
                console.log(`Marked commission split ${commission.id} as claimed by partner ${userDefaultPartnerId}`);
              }
            });
            
            claimedAny = true;
            claimedCommissions = [...unclaimedCommissions];
            unclaimedCommissions = [];
            
            console.log(`Successfully claimed ${claimedCommissions.length} commissions for user ${userId}`);
            
            // Verify the claims were successful
            const verifyQuery = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM \`CommissionSplit\` 
              WHERE \`phoneNumber\` = ${phoneNumber} AND claimed = true
            `;
            
            const count = Array.isArray(verifyQuery) && verifyQuery.length > 0 ? verifyQuery[0].count : 0;
            console.log(`Post-transaction verification: Found ${count} claimed commissions for ${phoneNumber}`);
          } catch (error) {
            console.error("Error claiming commissions:", error);
            return NextResponse.json({
              success: true,
              message: "Phone verified but error claiming commissions",
              data: {
                verified: true,
                hasUnclaimedCommissions: true,
                unclaimedCommissions: unclaimedCommissions,
                error: "Failed to claim commissions due to a database error"
              },
            });
          }
        } else {
          console.log("No commissions to claim for this phone number");
        }
      }
    } catch (error) {
      console.error("Error fetching commission splits:", error);
      // Continue with empty list on error
    }

    // Return appropriate response based on claim status
    if (claimedAny) {
      return NextResponse.json({
        success: true,
        message: "Phone verified and commissions claimed successfully",
        data: {
          verified: true,
          hasUnclaimedCommissions: false,
          unclaimedCommissions: [],
          claimedCommissions: claimedCommissions,
          claimedCount: claimedCommissions.length,
          alreadyClaimed: true
        },
      });
    } else {
      return NextResponse.json({
        success: true,
        message: verificationResult.message,
        data: {
          verified: true,
          hasUnclaimedCommissions: unclaimedCommissions.length > 0,
          unclaimedCommissions,
          userLoggedIn
        },
      });
    }
  } catch (error: any) {
    if (error.message === "Rate limit exceeded") {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    console.error("Error verifying phone number:", error);
    return NextResponse.json(
      { error: "Failed to verify phone number" },
      { status: 500 }
    );
  }
} 