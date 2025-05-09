import { prisma } from "@dub/prisma";
import { createId } from "../api/create-id";

/**
 * Represents a partner information object
 */
export interface PartnerInfo {
  id: string;
  name: string;
  role?: string;
  isDefault?: boolean;
  newlyAssociated?: boolean;
}

/**
 * Options for claiming commissions
 */
export interface ClaimCommissionOptions {
  phoneNumber: string;
  userId: string;
  partnerIds?: string[]; // Optional specific partners to claim for
}

/**
 * Result of claiming commissions
 */
export interface ClaimResult {
  success: boolean;
  claimedCount: number;
  totalEarnings: number;
  partnersAssociated: PartnerInfo[];
  errors?: string[];
}

/**
 * Service responsible for handling all commission claiming operations
 */
export class CommissionClaimService {
  /**
   * Claims all unclaimed commissions for a given phone number
   */
  async claimCommissions(options: ClaimCommissionOptions): Promise<ClaimResult> {
    console.log(`Starting commission claim for user ${options.userId} with phone ${options.phoneNumber}`);
    
    return await prisma.$transaction(async (tx) => {
      // 1. Find unclaimed commission splits for this phone
      const splits = await this.findUnclaimedSplits(tx, options.phoneNumber);
      
      if (splits.length === 0) {
        console.log(`No unclaimed splits found for phone ${options.phoneNumber}`);
        return { 
          success: true, 
          claimedCount: 0, 
          totalEarnings: 0, 
          partnersAssociated: [] 
        };
      }
      
      console.log(`Found ${splits.length} unclaimed splits for phone ${options.phoneNumber}`);
      
      // 2. Determine which partners to claim for
      const partnersForClaiming = await this.resolvePartners(tx, options);
      
      if (partnersForClaiming.length === 0) {
        console.log(`No valid partners found for claiming`);
        return { 
          success: false, 
          claimedCount: 0, 
          totalEarnings: 0, 
          partnersAssociated: [],
          errors: ["No valid partners found for claiming commissions"]
        };
      }
      
      // 3. Ensure user is associated with all relevant partners
      const partnersAssociated = await this.ensurePartnerAssociations(tx, options.userId, partnersForClaiming);
      
      // 4. Mark splits as claimed and attribute to proper partners
      const claimResults = await this.markSplitsAsClaimed(
        tx, 
        splits, 
        options.userId, 
        partnersForClaiming
      );
      
      // 5. Return standardized results
      return {
        success: true,
        claimedCount: claimResults.count,
        totalEarnings: claimResults.totalEarnings,
        partnersAssociated
      };
    });
  }
  
  /**
   * Find all unclaimed commission splits for a given phone number
   */
  private async findUnclaimedSplits(tx: any, phoneNumber: string) {
    return await tx.commissionSplit.findMany({
      where: {
        phoneNumber: phoneNumber,
        claimed: false,
      },
      include: {
        commission: {
          include: {
            program: true
          }
        }
      }
    });
  }
  
  /**
   * Resolve which partners should be used for claiming
   */
  private async resolvePartners(tx: any, options: ClaimCommissionOptions): Promise<any[]> {
    const { userId, phoneNumber, partnerIds } = options;
    
    // If specific partner IDs are provided, validate and use them
    if (partnerIds && partnerIds.length > 0) {
      const partners = await tx.partner.findMany({
        where: {
          id: { in: partnerIds },
          users: {
            some: {
              userId: userId
            }
          }
        }
      });
      
      if (partners.length > 0) {
        return partners;
      }
    }
    
    // Check if there's a partner with this phone number
    const partnersWithPhone = await tx.partner.findMany({
      where: {
        phoneNumber: phoneNumber
      }
    });
    
    if (partnersWithPhone.length > 0) {
      return partnersWithPhone;
    }
    
    // If no partner with this phone, use the user's default partner
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        partners: {
          include: {
            partner: true
          }
        }
      }
    });
    
    if (user?.defaultPartnerId) {
      const defaultPartner = await tx.partner.findUnique({
        where: { id: user.defaultPartnerId }
      });
      
      if (defaultPartner) {
        // Update the default partner with this phone number
        await tx.partner.update({
          where: { id: defaultPartner.id },
          data: { phoneNumber }
        });
        
        return [defaultPartner];
      }
    }
    
    // If user has any partners, use the first one
    if (user?.partners && user.partners.length > 0) {
      const firstPartner = user.partners[0].partner;
      
      // Update this partner with the phone number
      await tx.partner.update({
        where: { id: firstPartner.id },
        data: { phoneNumber }
      });
      
      return [firstPartner];
    }
    
    // No valid partners found
    return [];
  }
  
  /**
   * Ensure the user is associated with all the partners
   */
  private async ensurePartnerAssociations(tx: any, userId: string, partners: any[]): Promise<PartnerInfo[]> {
    const results: PartnerInfo[] = [];
    
    // Get user to check default partner
    const user = await tx.user.findUnique({
      where: { id: userId }
    });
    
    for (const partner of partners) {
      // Check if user already has this partner association
      const existingAssociation = await tx.partnerUser.findUnique({
        where: {
          userId_partnerId: {
            userId: userId,
            partnerId: partner.id
          }
        }
      });
      
      let newlyAssociated = false;
      
      if (!existingAssociation) {
        // Create new association
        await tx.partnerUser.create({
          data: {
            userId: userId,
            partnerId: partner.id,
            role: 'owner'
          }
        });
        newlyAssociated = true;
      }
      
      results.push({
        id: partner.id,
        name: partner.name || "Unnamed Partner",
        role: existingAssociation?.role || 'owner',
        isDefault: user?.defaultPartnerId === partner.id,
        newlyAssociated
      });
    }
    
    return results;
  }
  
  /**
   * Mark commission splits as claimed by the user for the given partners
   */
  private async markSplitsAsClaimed(
    tx: any,
    splits: any[],
    userId: string,
    partners: any[]
  ): Promise<{ count: number; totalEarnings: number }> {
    let count = 0;
    let totalEarnings = 0;
    
    // For simplicity, use the first partner for claiming
    const claimPartner = partners[0];
    
    for (const split of splits) {
      try {
        // Mark the split as claimed
        await tx.commissionSplit.update({
          where: { id: split.id },
          data: {
            claimed: true,
            claimedAt: new Date(),
            claimedByUserId: userId, // Points to userId
            partnerId: claimPartner.id, // Current field for partner association
            claimedByPartnerId: claimPartner.id, // DEPRECATED: Kept for backward compatibility
          }
        });
        
        count++;
        totalEarnings += split.earnings || 0;
      } catch (error) {
        console.error(`Error updating commission split ${split.id}:`, error);
      }
    }
    
    return { count, totalEarnings };
  }
}

// Create a singleton instance for easy import
export const commissionClaimService = new CommissionClaimService(); 