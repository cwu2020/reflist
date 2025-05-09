import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { phoneVerificationService } from "@/lib/services/phone-verification-service";
import { emitEvent } from "@/lib/events/emitter";
import { EventType, PhoneVerifiedEvent } from "@/lib/events/types";
import { registerEventHandlers } from "@/lib/events/register-handlers";

// Register event handlers to make sure they're set up
registerEventHandlers();

// Rate limiting - 10 attempts per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

// Define types for the commission data
type CommissionData = {
  id: string;
  amount?: number;
  currency?: string;
  earnings: number;
  linkTitle?: string;
  date: Date;
};

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(10, ip); // 10 requests per minute per IP
    
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and verification code are required" },
        { status: 400 }
      );
    }

    // Check if user is logged in
    const session = await getServerSession(authOptions);
    // Use type assertion since TypeScript doesn't know the extended session properties
    const user = session?.user as { id?: string; defaultPartnerId?: string } | undefined;
    const userId = user?.id;
    const userLoggedIn = !!userId;
    
    if (userLoggedIn) {
      console.log(`User authenticated: ${userId}`);
    } else {
      console.log('No authenticated user found in session');
    }

    // Verify the phone number
    const verificationResult = await phoneVerificationService.verifyPhone({ phoneNumber, code });
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { error: verificationResult.message },
        { status: 400 }
      );
    }
    
    // Phone verified successfully
    console.log(`Phone ${phoneNumber} verified successfully`);
    
    // If the user is logged in and there are unclaimed commissions, emit an event to claim them
    if (userLoggedIn && userId && verificationResult.hasUnclaimedCommissions) {
      console.log(`Emitting PHONE_VERIFIED event for user ${userId} with phone ${phoneNumber}`);
      
      // Emit event for asynchronous processing
      emitEvent(EventType.PHONE_VERIFIED, {
        phoneNumber,
        userId
      } as Omit<PhoneVerifiedEvent, 'type' | 'timestamp'>);
      
      return NextResponse.json({
        success: true,
        message: "Phone number verified successfully and commissions claiming process initiated",
        data: {
          verified: true,
          verifiedPhone: phoneNumber,
          hasUnclaimedCommissions: verificationResult.hasUnclaimedCommissions,
          unclaimedCommissionCount: verificationResult.unclaimedCommissionCount,
          unclaimedTotal: verificationResult.unclaimedTotal,
          unclaimedCommissions: verificationResult.unclaimedCommissions,
          userLoggedIn,
          claimStarted: true
        }
      });
    }
    
    // Return response for successful verification without claiming
    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
      data: {
        verified: true,
        verifiedPhone: phoneNumber,
        hasUnclaimedCommissions: verificationResult.hasUnclaimedCommissions,
        unclaimedCommissionCount: verificationResult.unclaimedCommissionCount,
        unclaimedTotal: verificationResult.unclaimedTotal,
        unclaimedCommissions: verificationResult.unclaimedCommissions,
        userLoggedIn
      }
    });
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