import { Twilio } from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// Only initialize the client if all required credentials are present
let twilioClient: Twilio | null = null;
if (accountSid && authToken) {
  twilioClient = new Twilio(accountSid, authToken);
}

/**
 * Send a verification code to a phone number
 * @param phoneNumber The phone number to send the verification code to
 * @returns Promise<boolean> True if the verification was sent successfully
 */
export const sendVerificationCode = async (phoneNumber: string): Promise<{success: boolean, message: string}> => {
  if (!twilioClient || !verifyServiceSid) {
    console.error('Twilio client not initialized or service SID not provided');
    return { 
      success: false, 
      message: 'Verification service not available' 
    };
  }

  try {
    // Request Twilio to send a verification token
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms'
      });

    console.log(`Verification sent to ${phoneNumber}, status: ${verification.status}`);
    
    return { 
      success: verification.status === 'pending', 
      message: 'Verification code sent successfully' 
    };
  } catch (error) {
    console.error('Error sending verification:', error);
    return { 
      success: false, 
      message: 'Failed to send verification code' 
    };
  }
};

/**
 * Check if a verification code is valid
 * @param phoneNumber The phone number that was verified
 * @param code The verification code to check
 * @returns Promise<boolean> True if the verification is valid
 */
export const checkVerificationCode = async (
  phoneNumber: string,
  code: string
): Promise<{success: boolean, message: string}> => {
  if (!twilioClient || !verifyServiceSid) {
    console.error('Twilio client not initialized or service SID not provided');
    return { 
      success: false, 
      message: 'Verification service not available' 
    };
  }

  try {
    // Verify the code provided by the user
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code
      });

    console.log(`Verification check for ${phoneNumber}: ${verificationCheck.status}`);
    
    return { 
      success: verificationCheck.status === 'approved', 
      message: verificationCheck.status === 'approved' 
        ? 'Phone number verified successfully' 
        : 'Invalid verification code' 
    };
  } catch (error) {
    console.error('Error checking verification:', error);
    return { 
      success: false, 
      message: 'Failed to verify code' 
    };
  }
};

/**
 * Fallback OTP implementation when Twilio is not configured
 * Uses our existing database token store
 */
export const sendFallbackVerificationCode = async (phoneNumber: string): Promise<string> => {
  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store the code in our database with an expiration
  // This is just a placeholder - in a real implementation, we would store this in our database
  console.log(`[DEVELOPMENT] Generated verification code for ${phoneNumber}: ${code}`);
  
  return code;
}; 