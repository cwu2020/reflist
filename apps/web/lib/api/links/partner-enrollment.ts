import { prisma } from '@dub/prisma';
import { getOrCreateProgramByUrl } from '@/lib/utils/program';
import { getApexDomain } from '@dub/utils';
import { ProgramEnrollmentStatus, CommissionType } from '@dub/prisma/client';
import { createId } from '@/lib/api/create-id';

/**
 * Creates a minimal fallback program with strictly limited field lengths
 * Used as last resort when normal program creation fails
 * 
 * @param workspaceId The workspace ID to create the program in
 * @returns The created program ID
 */
async function createBasicFallbackProgram(workspaceId: string): Promise<string> {
  try {
    console.log('Creating basic fallback program with minimal data');
    
    // Generate a unique ID and timestamp-based slug
    const programId = createId({ prefix: "prog_" });
    const timestamp = Date.now().toString(36);
    const slug = `fallback-${timestamp}`;
    
    // Create the program with minimal data and limited field lengths
    const program = await prisma.program.create({
      data: {
        id: programId,
        name: `Fallback Program ${timestamp.substring(0, 8)}`,
        slug,
        workspaceId,
        domain: "fallback.com",
        url: "https://fallback.com",
        cookieLength: 90,
        holdingPeriodDays: 30,
        minPayoutAmount: 10000
      }
    });
    
    // Create a basic reward
    const reward = await prisma.reward.create({
      data: {
        id: createId({ prefix: "rw_" }),
        programId: program.id,
        name: "Default Commission",
        event: "sale",
        type: CommissionType.percentage,
        amount: 10
      }
    });
    
    // Set as default reward
    await prisma.program.update({
      where: { id: program.id },
      data: { defaultRewardId: reward.id }
    });
    
    console.log(`Created basic fallback program: ${program.id}`);
    return program.id;
  } catch (error) {
    console.error('Error creating basic fallback program:', error);
    throw error;
  }
}

/**
 * Ensures a partner is enrolled in a program for a given product URL
 * If a program doesn't exist, it creates one
 * If the partner isn't enrolled, it enrolls them
 * Always creates a fallback program if anything fails
 * 
 * @param url The product URL 
 * @param workspaceId The workspace ID
 * @param partnerId The partner ID
 * @param shopmyMetadata Optional ShopMy merchant data from link creation
 * @returns The programId
 */
export async function ensurePartnerProgramEnrollment({
  url,
  workspaceId,
  partnerId,
  shopmyMetadata,
}: {
  url: string;
  workspaceId: string;
  partnerId: string;
  shopmyMetadata?: any;
}): Promise<string> {
  if (!partnerId || !workspaceId || !url) {
    throw new Error('Missing required parameters for partner program enrollment');
  }

  try {
    // Get or create program for the URL
    const { programId, isNewProgram } = await getOrCreateProgramByUrl(url, workspaceId, shopmyMetadata);
    
    // Check if partner is already enrolled in this program
    const existingEnrollment = await prisma.programEnrollment.findUnique({
      where: {
        partnerId_programId: {
          partnerId,
          programId,
        },
      },
    });
    
    // If partner is not enrolled, enroll them
    if (!existingEnrollment) {
      await prisma.programEnrollment.create({
        data: {
          id: createId({ prefix: "pge_" }),
          partnerId,
          programId,
          status: ProgramEnrollmentStatus.approved, // Auto-approve enrollment
        },
      });
    }
    
    return programId;
  } catch (error) {
    console.error('Error in ensurePartnerProgramEnrollment, creating fallback program:', error);
    
    try {
      // Use our new minimal fallback program creation
      const programId = await createBasicFallbackProgram(workspaceId);
      
      // Create program enrollment for the partner
      await prisma.programEnrollment.create({
        data: {
          id: createId({ prefix: "pge_" }),
          partnerId,
          programId,
          status: ProgramEnrollmentStatus.approved,
        },
      });
      
      console.log(`Successfully created and associated basic fallback program ${programId}`);
      return programId;
    } catch (fallbackError) {
      console.error('Failed to create fallback program:', fallbackError);
      throw new Error('Failed to create program for link. Please try again.');
    }
  }
}

/**
 * Gets the default partner for a user
 * If none exists, throws an error
 * 
 * @param userId The user ID
 * @returns The partner ID
 */
export async function getDefaultPartnerForUser(userId: string): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required to get default partner');
  }
  
  try {
    // Try to get user's default partner first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultPartnerId: true },
    });
    
    if (user?.defaultPartnerId) {
      return user.defaultPartnerId;
    }
    
    // If no default, try to find any partner associated with the user
    const partnerUser = await prisma.partnerUser.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { partnerId: true },
    });
    
    if (partnerUser?.partnerId) {
      // Update user's defaultPartnerId for future use
      await prisma.user.update({
        where: { id: userId },
        data: { defaultPartnerId: partnerUser.partnerId },
      });
      
      return partnerUser.partnerId;
    }
    
    throw new Error('No partner record found for this user');
  } catch (error) {
    console.error('Error in getDefaultPartnerForUser:', error);
    throw error;
  }
} 