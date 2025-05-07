import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendPhoneVerification } from "@/lib/verification/phone-verification";

// Rate limiting - 5 requests per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(5, ip); // 5 requests per minute per IP
    
    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone number format - basic validation
    // In production, use a more robust validation library
    if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Send verification code to the phone number
    const result = await sendPhoneVerification(phoneNumber);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error: any) {
    if (error.message === "Rate limit exceeded") {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    console.error("Error sending phone verification:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
} 