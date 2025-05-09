import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { commissionClaimService } from "@/lib/services/commission-claim-service";
import { rateLimit } from "@/lib/rate-limit";

// Rate limiting - 5 attempts per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

/**
 * POST endpoint for explicitly claiming commissions
 */
export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(5, ip); // 5 requests per minute per IP
    
    // Get request data
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }
    
    // Get current user session
    const session = await getServerSession(authOptions);
    
    // Type assertion for the user to include the id field
    const user = session?.user as { id?: string } | undefined;
    
    if (!session || !user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    
    // Claim commissions
    console.log(`Processing commission claim request for user ${userId} with phone ${phoneNumber}`);
    
    const result = await commissionClaimService.claimCommissions({
      phoneNumber,
      userId
    });
    
    return NextResponse.json({
      success: true,
      message: result.claimedCount > 0 
        ? `Successfully claimed ${result.claimedCount} commissions` 
        : "No commissions to claim",
      data: result
    });
  } catch (error: any) {
    console.error("Error claiming commissions:", error);
    
    if (error.message === "Rate limit exceeded") {
      return NextResponse.json(
        { error: "Too many claim attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to claim commissions" },
      { status: 500 }
    );
  }
} 