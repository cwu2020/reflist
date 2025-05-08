import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPhoneNumber } from "@/lib/verification/phone-verification";
import { prisma } from "@dub/prisma";

// Rate limiting - 10 attempts per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

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

    // Find commission splits associated with this phone number
    const splits = await (prisma as any).commissionSplit.findMany({
      where: {
        phoneNumber: phoneNumber,
        claimed: false,
      },
      include: {
        commission: {
          include: {
            link: true,
          },
        },
      },
    });

    // Filter out splits with null commission values
    const validSplits = splits.filter(split => split.commission !== null);

    return NextResponse.json({
      success: true,
      message: result.message,
      data: {
        verified: true,
        hasUnclaimedCommissions: validSplits.length > 0,
        unclaimedCommissions: validSplits.map((split) => ({
          id: split.id,
          amount: split.commission.amount,
          currency: split.commission.currency,
          earnings: split.earnings,
          linkTitle: split.commission.link?.title || "Unknown Link",
          date: split.createdAt,
        })),
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