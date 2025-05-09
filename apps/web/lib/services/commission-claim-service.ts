import { prisma } from "@dub/prisma";
import { createId } from "../api/create-id";
import { createWorkspaceId, prefixWorkspaceId } from "../api/workspace-id";
import { nanoid, generateRandomString } from "@dub/utils";
import { redis } from "../upstash";
import { Prisma } from "@dub/prisma/client";

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
      // 0. Ensure user has a workspace by checking if they have one already
      await this.ensureUserHasWorkspace(tx, options.userId);
      
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

  /**
   * Ensure the user has at least one workspace
   * This is needed because users coming through the claim flow might not have gone through
   * the normal signup flow that creates a workspace automatically
   */
  private async ensureUserHasWorkspace(tx: any, userId: string) {
    // First check if the user already has any workspaces
    const userProjects = await tx.projectUser.findMany({
      where: { userId },
      include: { project: true }
    });
    
    // If they already have projects, no need to create one
    if (userProjects.length > 0) {
      console.log(`User ${userId} already has ${userProjects.length} workspaces, no need to create a new one`);
      return;
    }
    
    // Get user info to create a personalized workspace
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });
    
    if (!user) {
      console.error(`User ${userId} not found, cannot create workspace`);
      return;
    }
    
    // Create workspace name based on user info
    const workspaceName = user.name 
      ? `${user.name}'s Workspace` 
      : user.email 
        ? `${user.email.split('@')[0]}'s Workspace` 
        : 'Personal Workspace';
    
    // Generate a slug from the workspace name
    const baseSlug = workspaceName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with a single one
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug exists and add a number if necessary
    while (true) {
      const existingWorkspace = await tx.project.findUnique({
        where: { slug },
      });
      
      if (!existingWorkspace) break;
      
      // If exists, try with a number suffix
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    console.log(`Creating personal workspace for user ${userId} with slug: ${slug}`);
    
    try {
      // Create the workspace
      const workspace = await tx.project.create({
        data: {
          id: createWorkspaceId(),
          name: workspaceName,
          slug,
          // Set high limits for creators
          linksLimit: 1000000, // Effectively unlimited links
          foldersLimit: 10, // Allow folders for creators
          users: {
            create: {
              userId,
              role: "owner",
              notificationPreference: {
                create: {},
              },
            },
          },
          billingCycleStart: new Date().getDate(),
          invoicePrefix: generateRandomString(8),
          inviteCode: nanoid(24),
          defaultDomains: {
            create: {}, // by default, we give users all the default domains
          },
        },
      });
      
      console.log(`Successfully created workspace with ID ${workspace.id} and slug ${workspace.slug}`);
      
      // Set this workspace as the user's default
      await tx.user.update({
        where: { id: userId },
        data: { defaultWorkspace: workspace.slug },
      });
      
      // Set onboarding step to completed
      await redis.set(`onboarding-step:${userId}`, "completed");
      
      return workspace;
    } catch (error) {
      console.error("Error creating personal workspace:", error);
      return null;
    }
  }
}

// Create a singleton instance for easy import
export const commissionClaimService = new CommissionClaimService(); 