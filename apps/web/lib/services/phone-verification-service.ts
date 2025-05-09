import { prisma } from "@dub/prisma";
import { verifyPhoneNumber as verifyPhoneCode } from "../verification/phone-verification";

/**
 * Options for verifying a phone number
 */
export interface VerifyPhoneOptions {
  phoneNumber: string;
  code: string;
}

/**
 * Result of a phone verification operation
 */
export interface VerificationResult {
  success: boolean;
  verified: boolean;
  hasUnclaimedCommissions: boolean;
  unclaimedCommissionCount: number;
  unclaimedTotal: number;
  unclaimedCommissions: any[];
  message?: string;
}

/**
 * Service responsible for handling phone verification
 */
export class PhoneVerificationService {
  /**
   * Verify a phone number with a verification code
   */
  async verifyPhone(options: VerifyPhoneOptions): Promise<VerificationResult> {
    const { phoneNumber, code } = options;
    
    // DEPRECATED: Special auto-claim code removed in favor of the event system
    // if (code === "AUTO_CLAIM_AFTER_LOGIN") {
    //   return {
    //     success: true,
    //     verified: true,
    //     hasUnclaimedCommissions: false,
    //     unclaimedCommissionCount: 0,
    //     unclaimedTotal: 0,
    //     unclaimedCommissions: [],
    //     message: "Auto-claim verification bypassed"
    //   };
    // }
    
    // Verify the code normally
    const verificationResponse = await this.validateCode(phoneNumber, code);
    
    if (!verificationResponse.success) {
      return {
        success: false,
        verified: false,
        hasUnclaimedCommissions: false,
        unclaimedCommissionCount: 0,
        unclaimedTotal: 0,
        unclaimedCommissions: [],
        message: verificationResponse.message
      };
    }
    
    // If verification successful, check for unclaimed commissions
    const { count, total, commissions } = await this.checkUnclaimedCommissions(phoneNumber);
    
    return {
      success: true,
      verified: true,
      hasUnclaimedCommissions: count > 0,
      unclaimedCommissionCount: count,
      unclaimedTotal: total,
      unclaimedCommissions: commissions,
      message: verificationResponse.message
    };
  }
  
  /**
   * Send a verification code to a phone number
   */
  async sendVerificationCode(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      // Re-use existing send function - this would typically call Twilio or similar
      // Placeholder for now - actual implementation would depend on existing code
      console.log(`Would send verification code to ${phoneNumber}`);
      
      return {
        success: true,
        message: "Verification code sent"
      };
    } catch (error) {
      console.error(`Error sending verification code to ${phoneNumber}:`, error);
      return {
        success: false,
        message: "Failed to send verification code"
      };
    }
  }
  
  /**
   * Validate a verification code for a phone number
   */
  private async validateCode(phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> {
    // Use the existing verification function
    return await verifyPhoneCode(phoneNumber, code);
  }
  
  /**
   * Check for unclaimed commissions for a phone number
   */
  private async checkUnclaimedCommissions(phoneNumber: string): Promise<{ count: number; total: number; commissions: any[] }> {
    try {
      // Use raw query to get more detailed commission splits info with link information
      const splitsResult = await prisma.$queryRaw`
        SELECT 
          s.\`id\`, 
          s.\`earnings\`, 
          s.\`createdAt\` as date, 
          c.\`id\` as commissionId,
          c.\`linkId\`,
          c.\`currency\`,
          l.\`key\` as linkKey,
          l.\`url\` as linkUrl,
          l.\`title\` as linkTitle,
          p.\`name\` as programName
        FROM \`CommissionSplit\` s
        LEFT JOIN \`Commission\` c ON s.\`commissionId\` = c.\`id\`
        LEFT JOIN \`Link\` l ON c.\`linkId\` = l.\`id\`
        LEFT JOIN \`Program\` p ON c.\`programId\` = p.\`id\`
        WHERE s.\`phoneNumber\` = ${phoneNumber} AND s.\`claimed\` = FALSE
      `;
      
      // Process the results to provide more user-friendly commission data
      const splits = Array.isArray(splitsResult) ? splitsResult.map((split: any) => ({
        id: split.id,
        earnings: split.earnings || 0,
        date: split.date,
        currency: split.currency || 'USD',
        linkId: split.linkId,
        linkKey: split.linkKey,
        linkUrl: split.linkUrl,
        linkTitle: split.linkTitle || 'Unknown Link', // Provide a fallback title
        programName: split.programName || 'Unknown Program'
      })) : [];
      
      const count = splits.length;
      const total = splits.reduce((sum, split: any) => sum + (split.earnings || 0), 0);
      
      console.log(`Found ${count} unclaimed commissions with total earnings ${total} for ${phoneNumber}`);
      
      // Return the enriched commissions data along with the counts
      return { count, total, commissions: splits };
    } catch (error) {
      console.error(`Error checking unclaimed commissions for ${phoneNumber}:`, error);
      return { count: 0, total: 0, commissions: [] };
    }
  }
}

// Create a singleton instance for easy import
export const phoneVerificationService = new PhoneVerificationService(); 