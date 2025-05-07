import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode, checkVerificationCode, sendFallbackVerificationCode } from "@/lib/twilio/client";

// Determine if we should use Twilio or fallback to database tokens
const useTwilio = process.env.USE_TWILIO_VERIFICATION === "true";

/**
 * Generate a hash for storing the verification token securely
 */
async function hashToken(token: string): Promise<string> {
  return hash(token, 10);
}

/**
 * Send a verification code to a phone number
 * This will either use Twilio or our database-backed solution depending on config
 */
export async function sendPhoneVerification(phoneNumber: string): Promise<{ success: boolean; message: string }> {
  // Remove any non-numeric characters from the phone number
  const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
  
  // Ensure phone number is in E.164 format (e.g., +1XXXXXXXXXX)
  // This is a simple check - in production you'd want more robust validation
  const formattedNumber = cleanPhoneNumber.startsWith("+") 
    ? cleanPhoneNumber 
    : `+${cleanPhoneNumber}`;

  try {
    // Delete any existing verification tokens for this phone number
    await prisma.PhoneVerificationToken.deleteMany({
      where: { identifier: formattedNumber },
    });

    if (useTwilio) {
      // Use Twilio for verification
      return await sendVerificationCode(formattedNumber);
    } else {
      // Use our own database-backed solution
      const token = await sendFallbackVerificationCode(formattedNumber);
      const hashedToken = await hashToken(token);
      
      // Store the token in our database with expiration time (10 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      await prisma.PhoneVerificationToken.create({
        data: {
          identifier: formattedNumber,
          token: hashedToken,
          expires: expiresAt,
        },
      });
      
      return { 
        success: true, 
        message: "Verification code sent successfully" 
      };
    }
  } catch (error) {
    console.error("Error sending phone verification:", error);
    return { 
      success: false, 
      message: "Failed to send verification code" 
    };
  }
}

/**
 * Verify a code sent to a phone number
 */
export async function verifyPhoneNumber(
  phoneNumber: string, 
  token: string
): Promise<{ success: boolean; message: string }> {
  // Clean and format the phone number
  const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
  const formattedNumber = cleanPhoneNumber.startsWith("+") 
    ? cleanPhoneNumber 
    : `+${cleanPhoneNumber}`;

  try {
    if (useTwilio) {
      // Use Twilio for verification
      return await checkVerificationCode(formattedNumber, token);
    } else {
      // Use our own database-backed solution
      const verificationToken = await prisma.PhoneVerificationToken.findFirst({
        where: {
          identifier: formattedNumber,
          expires: { gt: new Date() }, // Token must not be expired
        },
      });

      if (!verificationToken) {
        return { 
          success: false, 
          message: "Verification code expired or not found" 
        };
      }

      // Compare the provided token with the stored hash
      const isValid = await compare(token, verificationToken.token);

      if (isValid) {
        // Delete the token after successful verification
        await prisma.PhoneVerificationToken.delete({
          where: { id: verificationToken.id },
        });

        return { 
          success: true, 
          message: "Phone number verified successfully" 
        };
      } else {
        return { 
          success: false, 
          message: "Invalid verification code" 
        };
      }
    }
  } catch (error) {
    console.error("Error verifying phone number:", error);
    return { 
      success: false, 
      message: "Error during verification process" 
    };
  }
} 