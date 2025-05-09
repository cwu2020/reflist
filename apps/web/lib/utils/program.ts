import { customAlphabet } from 'nanoid';
import { getApexDomain, getDomainWithoutWWW } from '@dub/utils';
import { prisma } from '@dub/prisma';
import { fetchShopMyMerchantData } from '@/lib/shopmy';
import { CommissionType } from '@dub/prisma/client';
import { createId } from '../api/create-id';

// Alphanumeric characters without lookalikes (0/O, 1/I/l, etc.)
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const TOKEN_LENGTH = 6;

// Maximum URL length to store in the database
const MAX_URL_LENGTH = 1000; // Increased from 500 to handle longer URLs

/**
 * Safely truncates a URL to a maximum length
 * Ensures the URL remains valid by keeping the protocol and domain
 * Removes unnecessary query parameters if possible
 * 
 * @param url The URL to truncate
 * @param maxLength Maximum length allowed
 * @returns Truncated URL
 */
function truncateUrl(url: string, maxLength: number = MAX_URL_LENGTH): string {
  if (!url || url.length <= maxLength) {
    return url;
  }
  
  console.log(`Truncating long URL (${url.length} chars): ${url.substring(0, 100)}...`);
  
  try {
    // Try to clean the URL by removing common tracking parameters
    let cleanUrl = url;
    try {
      const urlObj = new URL(url);
      
      // List of common tracking parameters to remove
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'ref', 'referrer', 'source', 'campaign',
        '_ga', '_gl', '_hsenc', '_hsmi', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad',
        'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver'
      ];
      
      // Remove tracking parameters
      const searchParams = urlObj.searchParams;
      let paramsRemoved = false;
      
      trackingParams.forEach(param => {
        if (searchParams.has(param)) {
          searchParams.delete(param);
          paramsRemoved = true;
        }
      });
      
      if (paramsRemoved) {
        cleanUrl = urlObj.toString();
        console.log(`Removed tracking parameters, new length: ${cleanUrl.length}`);
      }
    } catch (cleanError) {
      // If cleaning fails, continue with original URL
      console.warn('Error cleaning URL parameters:', cleanError);
    }
    
    // If the cleaned URL is now under the max length, use it
    if (cleanUrl.length <= maxLength) {
      return cleanUrl;
    }
    
    // Parse the URL to keep the origin (protocol + domain)
    const urlObj = new URL(cleanUrl);
    const origin = urlObj.origin;
    
    // If even the origin is too long (very unlikely but possible), just take the first part of it
    if (origin.length >= maxLength) {
      console.warn(`URL origin exceeds max length: ${origin.length} > ${maxLength}`);
      return origin.substring(0, maxLength);
    }
    
    // Calculate how much of the pathname + search we can keep
    const remainingLength = maxLength - origin.length - 1; // -1 for the slash
    let pathWithSearch = urlObj.pathname;
    
    // If path is too long, truncate it before adding search params
    if (pathWithSearch.length > remainingLength) {
      pathWithSearch = pathWithSearch.substring(0, remainingLength);
      return `${origin}${pathWithSearch}`;
    }
    
    // Add search params if there's space
    if (remainingLength - pathWithSearch.length > 0 && urlObj.search) {
      // Only keep the first few search params that fit
      const searchPart = urlObj.search.substring(0, remainingLength - pathWithSearch.length);
      pathWithSearch += searchPart;
    }
    
    const truncatedUrl = `${origin}${pathWithSearch}`;
    console.log(`Successfully truncated URL to ${truncatedUrl.length} chars`);
    return truncatedUrl;
  } catch (error) {
    // If URL parsing fails, do a simple truncation but try to preserve a valid URL structure
    console.error("Error truncating URL:", error);
    
    // Try to extract domain without URL parsing
    let fallbackUrl = url;
    try {
      // If there's a protocol, keep it and the domain
      if (url.includes('://')) {
        const parts = url.split('://');
        const protocol = parts[0];
        const rest = parts[1];
        
        // Take the domain part (up to first slash after protocol)
        const domainEnd = rest.indexOf('/');
        if (domainEnd > 0) {
          const domain = rest.substring(0, domainEnd);
          fallbackUrl = `${protocol}://${domain}`;
        } else {
          fallbackUrl = `${protocol}://${rest}`;
        }
      }
    } catch (fallbackError) {
      console.error("Error creating fallback URL:", fallbackError);
    }
    
    // Final fallback is simple truncation
    return fallbackUrl.substring(0, maxLength);
  }
}

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
 * Extracts domain from URL with enhanced error handling
 * Fallback to simpler extraction methods if the primary method fails
 * 
 * @param url The URL to extract domain from
 * @returns The apex domain or a fallback value
 */
export function extractDomainSafely(url: string): string {
  // First try the standard method
  const domain = getApexDomain(url);
  if (domain) {
    return domain;
  }

  console.warn(`Standard domain extraction failed for URL: ${url.substring(0, 100)}...`);
  
  // Fallback method 1: Try getting domain without www
  const domainWithoutWWW = getDomainWithoutWWW(url);
  if (domainWithoutWWW) {
    console.log(`Recovered domain using getDomainWithoutWWW: ${domainWithoutWWW}`);
    return domainWithoutWWW;
  }
  
  // Fallback method 2: Manual extraction
  try {
    // Handle case when URL is just a domain or has no protocol
    let urlToProcess = url;
    if (!url.includes('://')) {
      urlToProcess = `https://${url}`;
    }
    
    const hostname = new URL(urlToProcess).hostname;
    // Get the last two or three parts of the hostname
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch (e) {
    console.error(`All domain extraction methods failed for URL: ${url.substring(0, 100)}...`);
    
    // Last resort: Try to find anything that looks like a domain
    const domainRegex = /[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/;
    const match = url.match(domainRegex);
    if (match && match[0]) {
      console.log(`Extracted domain using regex: ${match[0]}`);
      return match[0];
    }
    
    // If all else fails, use a generic domain
    return 'unknown-domain.com';
  }
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
    const domain = extractDomainSafely(url);
    
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
 * Creates a new program for a URL
 * This is meant to be used during link creation
 * Updated to always create a new program for each link
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
    console.log(`Processing URL for program creation: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    
    // Extract domain from URL with enhanced error handling
    const domain = extractDomainSafely(url);
    console.log(`Extracted domain: ${domain}`);
    
    // Create a new program regardless of existing programs with the same domain
    console.log(`Creating new program for URL: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    
    // Default commission data
    let commissionData = {
      type: 'percentage' as CommissionType,
      amount: 10, // Default 10%
    };
    
    // Use the original URL if it exists (from ShopMy integration)
    // This ensures we're using the merchant's actual URL, not ShopMy's tracking URL
    let originalUrl = (shopmyMetadata && 'originalUrl' in shopmyMetadata) ? 
      shopmyMetadata.originalUrl : 
      (url.includes('shopmy.us') ? null : url);
    
    // Truncate URL if needed to avoid database column size issues
    if (originalUrl) {
      originalUrl = truncateUrl(originalUrl);
    }
    
    let safeUrl = truncateUrl(url);

    // If shopmy metadata is passed, use it directly instead of making another API call
    if (shopmyMetadata) {
      console.log('Using provided ShopMy metadata');
      // Convert commission data from ShopMy format to our format
      if (shopmyMetadata.fullPayout && shopmyMetadata.rateType) {
        // ShopMy provides percentage as a whole number (e.g., 15 for 15%)
        commissionData.amount = shopmyMetadata.fullPayout;
        
        // ShopMy uses 'percentage' or 'flat' for rateType
        commissionData.type = shopmyMetadata.rateType === 'percentage' ? 
          CommissionType.percentage : CommissionType.flat;
        
        console.log(`Set commission from metadata: ${commissionData.amount}% (${commissionData.type})`);
      }
    } else {
      // Fall back to API call if no metadata was passed
      console.log('No ShopMy metadata provided, fetching from API');
      try {
        const urlToFetch = originalUrl || safeUrl;
        console.log(`Fetching ShopMy data for: ${urlToFetch.substring(0, 100)}${urlToFetch.length > 100 ? '...' : ''}`);
        
        const merchantData = await fetchShopMyMerchantData(urlToFetch);
        if (merchantData) {
          console.log('Successfully fetched ShopMy merchant data');
          // Convert commission data from ShopMy format to our format
          if (merchantData.fullPayout && merchantData.rateType) {
            // ShopMy provides percentage as a whole number (e.g., 15 for 15%)
            commissionData.amount = merchantData.fullPayout;
            
            // ShopMy uses 'percentage' or 'flat' for rateType
            commissionData.type = merchantData.rateType === 'percentage' ? 
              CommissionType.percentage : CommissionType.flat;
            
            console.log(`Set commission from API: ${commissionData.amount}% (${commissionData.type})`);
          }
        } else {
          console.log('No merchant data returned from ShopMy, using default commission');
        }
      } catch (error) {
        console.error('Error fetching ShopMy merchant data:', error);
        console.log('Using default commission data due to ShopMy API error');
        // Continue with default commission data
      }
    }
    
    // Generate a unique program slug with more randomness to ensure uniqueness
    const domainLabel = domain.split('.')[0].toLowerCase();
    // Add timestamp and random token to ensure uniqueness
    const uniqueToken = `${Date.now().toString(36)}-${generateDomainToken('uniqueness').toLowerCase()}`;
    const slug = `${domainLabel}-${uniqueToken}`;
    
    console.log(`Creating program with unique slug: ${slug}`);
    
    // Create program with default commission structure
    const newProgram = await prisma.$transaction(async (tx) => {
      // Create the program
      const program = await tx.program.create({
        data: {
          id: createId({ prefix: "prog_" }),
          name: `${domain} (${uniqueToken})`.substring(0, 60), // Limit name length
          slug,
          domain,
          url: originalUrl || safeUrl, // Use original URL if available
          workspaceId,
          cookieLength: 90, // 90 days default cookie length
          holdingPeriodDays: 30, // 30 days default holding period
          minPayoutAmount: 10000, // $100 minimum payout amount (in cents)
        },
      });
      
      console.log(`Created program: ${program.id}`);
      
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
      
      console.log(`Created reward: ${reward.id} with ${commissionData.amount}% commission`);
      
      // Set this reward as the default reward for the program
      await tx.program.update({
        where: { id: program.id },
        data: { defaultRewardId: reward.id },
      });
      
      return program;
    });
    
    console.log(`Successfully created new program: ${newProgram.id}`);
    
    return {
      programId: newProgram.id,
      isNewProgram: true, // Always true since we're always creating a new program
    };
  } catch (error) {
    console.error('Error in getOrCreateProgramByUrl:', error);
    
    // Create a fallback program as last resort
    try {
      console.log('Attempting to create fallback program');
      
      // Generate a unique fallback slug
      const uniqueToken = `${Date.now().toString(36)}-${generateDomainToken('fallback').toLowerCase()}`;
      const slug = `program-${uniqueToken}`;
      
      // Extract domain with best-effort approach
      let domain = 'unknown.com';
      try {
        if (url.includes('://')) {
          domain = url.split('://')[1].split('/')[0];
        } else if (url.includes('/')) {
          domain = url.split('/')[0];
        } else {
          domain = url.substring(0, Math.min(url.length, 50));
        }
      } catch (e) {
        console.error('Error extracting domain for fallback:', e);
      }
      
      // Create fallback program
      const fallbackProgram = await prisma.$transaction(async (tx) => {
        // Create the program
        const program = await tx.program.create({
          data: {
            id: createId({ prefix: "prog_" }),
            name: `Unknown Program (${new Date().toISOString().substring(0, 10)}) ${uniqueToken}`.substring(0, 60),
            slug,
            domain: domain.toLowerCase().replace(/[^a-z0-9\.\-]/g, '').substring(0, 50),
            url: truncateUrl(url), 
            workspaceId,
            cookieLength: 90,
            holdingPeriodDays: 30,
            minPayoutAmount: 10000,
          },
        });
        
        // Create default reward for the program
        const reward = await tx.reward.create({
          data: {
            id: createId({ prefix: "rw_" }),
            programId: program.id,
            name: `Default Commission`,
            event: 'sale',
            type: CommissionType.percentage,
            amount: 10, // Default 10%
          },
        });
        
        // Set this reward as the default reward for the program
        await tx.program.update({
          where: { id: program.id },
          data: { defaultRewardId: reward.id },
        });
        
        return program;
      });
      
      console.log(`Created fallback program as last resort: ${fallbackProgram.id}`);
      
      return {
        programId: fallbackProgram.id,
        isNewProgram: true,
      };
    } catch (fallbackError) {
      console.error('Even fallback program creation failed:', fallbackError);
      throw error; // Throw the original error
    }
  }
} 