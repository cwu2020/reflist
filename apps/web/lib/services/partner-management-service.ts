import { prisma } from "@dub/prisma";

/**
 * Service responsible for managing partner relationships
 */
export class PartnerManagementService {
  /**
   * Find a partner by phone number
   */
  async findPartnerByPhone(phoneNumber: string): Promise<any | null> {
    try {
      // Use raw query to avoid any Prisma schema issues
      const partners = await prisma.$queryRaw`
        SELECT * FROM \`Partner\` WHERE \`phoneNumber\` = ${phoneNumber} LIMIT 1
      `;
      
      return Array.isArray(partners) && partners.length > 0 ? partners[0] : null;
    } catch (error) {
      console.error(`Error finding partner by phone ${phoneNumber}:`, error);
      return null;
    }
  }
  
  /**
   * Associate a user with a partner
   */
  async associateUserWithPartner(
    userId: string, 
    partnerId: string, 
    role: 'owner' | 'member' = 'owner'
  ): Promise<boolean> {
    try {
      // Check if the association already exists
      const existingAssociation = await prisma.partnerUser.findUnique({
        where: {
          userId_partnerId: {
            userId: userId,
            partnerId: partnerId
          }
        }
      });
      
      if (existingAssociation) {
        // Already associated, just return true
        return true;
      }
      
      // Create a new association
      await prisma.partnerUser.create({
        data: {
          userId: userId,
          partnerId: partnerId,
          role: role
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error associating user ${userId} with partner ${partnerId}:`, error);
      return false;
    }
  }
  
  /**
   * Get all partners for a user
   */
  async getPartnersForUser(userId: string): Promise<any[]> {
    try {
      // Get all partners for a user including the partner details
      const partnerUsers = await prisma.partnerUser.findMany({
        where: {
          userId: userId
        },
        include: {
          partner: true
        }
      });
      
      return partnerUsers.map(pu => pu.partner);
    } catch (error) {
      console.error(`Error getting partners for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Update a partner's phone number
   */
  async updatePartnerPhone(partnerId: string, phoneNumber: string): Promise<boolean> {
    try {
      // Using raw query to avoid potential Prisma model issues
      await prisma.$executeRaw`
        UPDATE \`Partner\` SET \`phoneNumber\` = ${phoneNumber} 
        WHERE \`id\` = ${partnerId}
      `;
      
      return true;
    } catch (error) {
      console.error(`Error updating phone for partner ${partnerId}:`, error);
      return false;
    }
  }
  
  /**
   * Get a user's default partner
   */
  async getUserDefaultPartner(userId: string): Promise<any | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { defaultPartnerId: true }
      });
      
      if (!user?.defaultPartnerId) {
        return null;
      }
      
      const partner = await prisma.partner.findUnique({
        where: { id: user.defaultPartnerId }
      });
      
      return partner;
    } catch (error) {
      console.error(`Error getting default partner for user ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Set a user's default partner
   */
  async setUserDefaultPartner(userId: string, partnerId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultPartnerId: partnerId }
      });
      
      return true;
    } catch (error) {
      console.error(`Error setting default partner ${partnerId} for user ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Ensure a user is associated with a partner
   */
  async ensureUserAssociatedWithPartner(userId: string, partnerId: string): Promise<boolean> {
    try {
      // Check if association already exists
      const existingAssociation = await prisma.partnerUser.findUnique({
        where: {
          userId_partnerId: {
            userId,
            partnerId
          }
        }
      });
      
      // If association already exists, return true
      if (existingAssociation) {
        console.log(`User ${userId} is already associated with partner ${partnerId}`);
        return true;
      }
      
      // Create association
      await prisma.partnerUser.create({
        data: {
          userId,
          partnerId,
          role: 'owner' // Default to owner for claimed partners
        }
      });
      
      console.log(`Associated user ${userId} with partner ${partnerId} as owner`);
      
      // Check if user already has a default partner
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { defaultPartnerId: true }
      });
      
      // If user doesn't have a default partner, set this one as default
      if (!user?.defaultPartnerId) {
        await prisma.user.update({
          where: { id: userId },
          data: { defaultPartnerId: partnerId }
        });
        console.log(`Set partner ${partnerId} as default for user ${userId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error associating user ${userId} with partner ${partnerId}:`, error);
      return false;
    }
  }
}

// Create a singleton instance for easy import
export const partnerManagementService = new PartnerManagementService(); 