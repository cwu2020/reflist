import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPhoneNumber } from "@/lib/verification/phone-verification";
import { prisma } from "@dub/prisma";

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

    // Verify the code
    const result = await verifyPhoneNumber(phoneNumber, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // First, get just the basic commission split data without related fields
    let unclaimedCommissions: CommissionData[] = [];
    try {
      // Get the commission splits first without including relations
      const splits = await (prisma as any).commissionSplit.findMany({
        where: {
          phoneNumber: phoneNumber,
          claimed: false,
        },
      });
      
      // Use the splits directly even if commission data is missing
      unclaimedCommissions = splits.map(split => ({
        id: split.id,
        // Default values if commission data isn't available
        amount: 0, 
        currency: "USD",
        earnings: split.earnings,
        linkTitle: "Commission", 
        date: split.createdAt,
      }));

      // Try to enhance with commission data where possible, but don't fail if it's not available
      try {
        for (let i = 0; i < unclaimedCommissions.length; i++) {
          const split = splits[i];
          const commission = await (prisma as any).commission.findUnique({
            where: { id: split.commissionId },
            include: { link: true }
          });
          
          if (commission) {
            unclaimedCommissions[i] = {
              ...unclaimedCommissions[i],
              amount: commission.amount,
              currency: commission.currency,
              linkTitle: commission.link?.title || "Unknown Link",
            };
          }
        }
      } catch (error) {
        console.error("Error fetching commission details:", error);
        // Continue with basic data if commission details can't be fetched
      }
      
    } catch (error) {
      console.error("Error fetching commission splits:", error);
      // If there's an error with the query, just return empty commissions
      unclaimedCommissions = [];
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        verified: true,
        hasUnclaimedCommissions: unclaimedCommissions.length > 0,
        unclaimedCommissions,
      },
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