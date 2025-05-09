import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { nanoid } from "@dub/utils";
import { prisma } from "@dub/prisma";

const COOKIE_NAME = "pending-phone-verification";
const EXPIRY_HOURS = 24; // Cookie and database record expiry time in hours

// POST /api/auth/phone-verification
// Store the phone verification data and set a cookie with the token
export async function POST(request: Request) {
  try {
    const { phoneNumber, unclaimedCount, totalEarnings } = await request.json();
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Missing phoneNumber parameter" },
        { status: 400 }
      );
    }
    
    console.log(`Processing phone verification for ${phoneNumber} with ${unclaimedCount} unclaimed commissions`);
    
    // Generate a unique token
    const token = nanoid(32);
    
    // Calculate expiry date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPIRY_HOURS);
    
    // Store in database
    await prisma.pendingPhoneVerification.create({
      data: {
        token,
        phoneNumber,
        unclaimedCount: unclaimedCount || 0,
        totalEarnings: totalEarnings || 0,
        expiresAt,
      }
    });
    
    console.log(`Created verification record with token ${token} for phone ${phoneNumber}`);
    
    // Set an HTTP-only cookie with the token
    // This will persist through the OAuth redirect
    cookies().set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: "/",
      expires: expiresAt,
      sameSite: "lax", // Allow the cookie to be sent during redirects
      secure: process.env.NODE_ENV === "production",
    });
    
    return NextResponse.json({ 
      success: true,
      token
    });
  } catch (error) {
    console.error("Error storing phone verification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/auth/phone-verification
// Retrieve the phone verification data from the token in the cookie
export async function GET() {
  try {
    // Get the token from the cookie
    const token = cookies().get(COOKIE_NAME)?.value;
    
    if (!token) {
      return NextResponse.json({ verification: null });
    }
    
    console.log(`Looking up verification data for token: ${token}`);
    
    // Look up the verification data
    const verification = await prisma.pendingPhoneVerification.findUnique({
      where: { token }
    });
    
    if (!verification) {
      console.log(`No verification found for token: ${token}`);
      // Delete the cookie if no matching verification found
      cookies().delete(COOKIE_NAME);
      return NextResponse.json({ verification: null });
    }
    
    // Check if the verification has expired
    if (verification.expiresAt < new Date()) {
      console.log(`Verification expired for token: ${token}`);
      // Delete expired verification and cookie
      await prisma.pendingPhoneVerification.delete({
        where: { token }
      });
      cookies().delete(COOKIE_NAME);
      return NextResponse.json({ verification: null, expired: true });
    }
    
    console.log(`Found verification data for phone: ${verification.phoneNumber}`);
    
    // Don't delete the verification yet, keep it until it's claimed or expired
    // We'll only clear the cookie in case the user doesn't complete the process
    
    return NextResponse.json({ verification });
  } catch (error) {
    console.error("Error retrieving phone verification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 