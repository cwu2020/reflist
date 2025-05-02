import { customAlphabet } from 'nanoid';
import { getApexDomain } from '@dub/utils';
import { prisma } from '@dub/prisma';
import { fetchShopMyMerchantData } from '@/lib/shopmy';
import { CommissionType } from '@dub/prisma/client';
import { createId } from '../api/create-id';

// Alphanumeric characters without lookalikes (0/O, 1/I/l, etc.)
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const TOKEN_LENGTH = 6;

/**
 * Generates a deterministic token for a domain
 * The token is a 6-character string of alphanumeric characters
 * 
 * @param domain The domain to generate a token for
 * @returns A 6-character token
 */
export function generateDomainToken(domain: string): string {
  const nanoid = customAlphabet(TOKEN_ALPHABET, TOKEN_LENGTH);
  return nanoid();
}

/**
 * Creates a programId from a product URL
 * Format: {domain}_{TOKEN}
 * Example: cultgaia_ABC123
 * 
 * @param url The product URL
 * @returns The generated programId
 */
export function generateProgramId(url: string): string {
  try {
    // Extract domain from URL
    const domain = getApexDomain(url);
    if (!domain) {
      throw new Error('Invalid URL');
    }
    
    // Sanitize domain (remove special characters, keep only alphanumeric)
    const sanitizedDomain = domain
      .split('.')[0] // Take only the first part of the domain (e.g., 'cultgaia' from 'cultgaia.com')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    // Generate token
    const token = generateDomainToken(domain);
    
    // Return programId in the format {domain}_{TOKEN}
    return `${sanitizedDomain}_${token}`;
  } catch (error) {
    console.error('Error generating programId:', error);
    // Fallback to a generic format if there's an error
    return `program_${generateDomainToken('fallback')}`;
  }
}

/**
 * Gets an existing program by domain or creates a new one
 * This is meant to be used during link creation
 * 
 * @param url The product URL
 * @param workspaceId The workspace ID
 * @param shopmyMetadata Optional ShopMy merchant data passed from link creation
 * @returns Promise resolving to the program information
 */
export async function getOrCreateProgramByUrl(
  url: string, 
  workspaceId: string,
  shopmyMetadata?: any
): Promise<{
  programId: string;
  isNewProgram: boolean;
}> {
  try {
    // Extract domain from URL
    const domain = getApexDomain(url);
    if (!domain) {
      throw new Error('Invalid URL');
    }
    
    // Check if a program already exists for this domain in this workspace
    const existingProgram = await prisma.program.findFirst({
      where: {
        workspaceId,
        domain,
      },
    });
    
    if (existingProgram) {
      return {
        programId: existingProgram.id,
        isNewProgram: false,
      };
    }
    
    // Program doesn't exist, create a new one
    // Default commission data
    let commissionData = {
      type: 'percentage' as CommissionType,
      amount: 10, // Default 10%
    };
    
    // Use the original URL if it exists (from ShopMy integration)
    // This ensures we're using the merchant's actual URL, not ShopMy's tracking URL
    const originalUrl = (shopmyMetadata && 'originalUrl' in shopmyMetadata) ? 
      shopmyMetadata.originalUrl : 
      (url.includes('shopmy.us') ? null : url);

    // If shopmy metadata is passed, use it directly instead of making another API call
    if (shopmyMetadata) {
      // Convert commission data from ShopMy format to our format
      if (shopmyMetadata.fullPayout && shopmyMetadata.rateType) {
        // ShopMy provides percentage as a whole number (e.g., 15 for 15%)
        commissionData.amount = shopmyMetadata.fullPayout;
        
        // ShopMy uses 'percentage' or 'flat' for rateType
        commissionData.type = shopmyMetadata.rateType === 'percentage' ? 
          CommissionType.percentage : CommissionType.flat;
      }
    } else {
      // Fall back to API call if no metadata was passed
      try {
        const merchantData = await fetchShopMyMerchantData(originalUrl || url);
        if (merchantData) {
          // Convert commission data from ShopMy format to our format
          if (merchantData.fullPayout && merchantData.rateType) {
            // ShopMy provides percentage as a whole number (e.g., 15 for 15%)
            commissionData.amount = merchantData.fullPayout;
            
            // ShopMy uses 'percentage' or 'flat' for rateType
            commissionData.type = merchantData.rateType === 'percentage' ? 
              CommissionType.percentage : CommissionType.flat;
          }
        }
      } catch (error) {
        console.error('Error fetching ShopMy merchant data:', error);
        // Continue with default commission data
      }
    }
    
    // Generate a unique program slug from the domain
    const domainLabel = domain.split('.')[0].toLowerCase();
    const slug = `${domainLabel}-${generateDomainToken(domain).toLowerCase()}`;
    
    // Create program with default commission structure
    const newProgram = await prisma.$transaction(async (tx) => {
      // Create the program
      const program = await tx.program.create({
        data: {
          id: createId({ prefix: "prog_" }),
          name: domain,
          slug,
          domain,
          url: originalUrl || url, // Use original URL if available
          workspaceId,
          cookieLength: 90, // 90 days default cookie length
          holdingPeriodDays: 30, // 30 days default holding period
          minPayoutAmount: 10000, // $100 minimum payout amount (in cents)
        },
      });
      
      // Create default reward for the program
      const reward = await tx.reward.create({
        data: {
          id: createId({ prefix: "rw_" }),
          programId: program.id,
          name: `Default ${domain} Commission`,
          event: 'sale', // Default to sale event
          type: commissionData.type,
          amount: commissionData.amount,
        },
      });
      
      // Set this reward as the default reward for the program
      await tx.program.update({
        where: { id: program.id },
        data: { defaultRewardId: reward.id },
      });
      
      return program;
    });
    
    return {
      programId: newProgram.id,
      isNewProgram: true,
    };
  } catch (error) {
    console.error('Error in getOrCreateProgramByUrl:', error);
    throw error;
  }
} 