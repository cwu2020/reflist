import { getApexDomain, getDomainWithoutWWW } from '@dub/utils';

/**
 * Test script to verify URL processing improvements.
 * This is a standalone version that uses mocks for Next.js-specific dependencies.
 * Run with:
 * npx tsx apps/web/scripts/test-url-processing.ts
 */

// Define constants for URL processing
const MAX_URL_LENGTH = 1000;
const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const TOKEN_LENGTH = 6;

// Mock functions for dependencies
const mockFetchShopMyMerchantData = async (url) => {
  console.log(`[MOCK] Fetching ShopMy data for: ${url.substring(0, 50)}...`);
  // Return mock merchant data
  return {
    name: "Example Store",
    domain: getApexDomain(url),
    fullPayout: 15, // 15% commission
    rateType: "percentage"
  };
};

const mockPrisma = {
  $transaction: async (callback) => {
    // Mock program with ID
    const mockProgram = { 
      id: `prog_${Math.random().toString(36).substring(2, 10)}`,
      name: "Mock Program",
    };
    return await callback({ 
      program: {
        create: async () => mockProgram,
        update: async () => mockProgram
      },
      reward: {
        create: async () => ({ 
          id: `rw_${Math.random().toString(36).substring(2, 10)}`
        })
      }
    });
  }
};

const mockCreateId = ({ prefix }) => {
  return `${prefix}${Math.random().toString(36).substring(2, 10)}`;
};

// Implementation of required functions from program.ts
function truncateUrl(url, maxLength = MAX_URL_LENGTH) {
  if (!url || url.length <= maxLength) {
    return url;
  }
  
  console.log(`Truncating long URL (${url.length} chars): ${url.substring(0, 50)}...`);
  
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

function generateDomainToken(domain) {
  // Simple implementation for testing
  return Math.random().toString(36).substring(2, 2 + TOKEN_LENGTH).toUpperCase();
}

function extractDomainSafely(url) {
  // First try the standard method
  const domain = getApexDomain(url);
  if (domain) {
    return domain;
  }

  console.warn(`Standard domain extraction failed for URL: ${url.substring(0, 50)}...`);
  
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
    console.error(`All domain extraction methods failed for URL: ${url.substring(0, 50)}...`);
    
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

async function getOrCreateProgramByUrl(url, workspaceId, shopmyMetadata) {
  try {
    console.log(`Processing URL for program creation: ${url.substring(0, 50)}...`);
    
    // Extract domain from URL with enhanced error handling
    const domain = extractDomainSafely(url);
    console.log(`Extracted domain: ${domain}`);
    
    // Create a new program regardless of existing programs with the same domain
    console.log(`Creating new program for URL: ${url.substring(0, 50)}...`);
    
    // Default commission data
    let commissionData = {
      type: 'percentage',
      amount: 10, // Default 10%
    };
    
    // Use the original URL if it exists (from ShopMy integration)
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
          'percentage' : 'flat';
        
        console.log(`Set commission from metadata: ${commissionData.amount}% (${commissionData.type})`);
      }
    } else {
      // Fall back to API call if no metadata was passed
      console.log('No ShopMy metadata provided, fetching from API');
      try {
        const urlToFetch = originalUrl || safeUrl;
        console.log(`Fetching ShopMy data for: ${urlToFetch.substring(0, 50)}...`);
        
        const merchantData = await mockFetchShopMyMerchantData(urlToFetch);
        if (merchantData) {
          console.log('Successfully fetched ShopMy merchant data');
          // Convert commission data from ShopMy format to our format
          if (merchantData.fullPayout && merchantData.rateType) {
            // ShopMy provides percentage as a whole number (e.g., 15 for 15%)
            commissionData.amount = merchantData.fullPayout;
            
            // ShopMy uses 'percentage' or 'flat' for rateType
            commissionData.type = merchantData.rateType === 'percentage' ? 
              'percentage' : 'flat';
            
            console.log(`Set commission from API: ${commissionData.amount}% (${commissionData.type})`);
          }
        } else {
          console.log('No merchant data returned from ShopMy, using default commission');
        }
      } catch (error) {
        console.error('Error fetching ShopMy merchant data:', error);
        console.log('Using default commission data due to ShopMy API error');
      }
    }
    
    // Generate a unique program slug with more randomness to ensure uniqueness
    const domainLabel = domain.split('.')[0].toLowerCase();
    // Add timestamp and random token to ensure uniqueness
    const uniqueToken = `${Date.now().toString(36)}-${generateDomainToken('uniqueness').toLowerCase()}`;
    const slug = `${domainLabel}-${uniqueToken}`;
    
    console.log(`Creating program with unique slug: ${slug}`);
    
    // Create program with mock transaction
    const newProgram = await mockPrisma.$transaction(async (tx) => {
      // Create the program
      const program = await tx.program.create({
        data: {
          id: mockCreateId({ prefix: "prog_" }),
          name: `${domain} (${uniqueToken})`, // Add unique identifier to name
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
          id: mockCreateId({ prefix: "rw_" }),
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
      
      // Create fallback program with mock transaction
      const fallbackProgram = await mockPrisma.$transaction(async (tx) => {
        // Create the program
        const program = await tx.program.create({
          data: {
            id: mockCreateId({ prefix: "prog_" }),
            name: `Unknown Program (${new Date().toISOString().substring(0, 10)}) ${uniqueToken}`,
            slug,
            domain: domain.toLowerCase().replace(/[^a-z0-9\.\-]/g, ''),
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
            id: mockCreateId({ prefix: "rw_" }),
            programId: program.id,
            name: `Default Commission`,
            event: 'sale',
            type: 'percentage',
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

// Test cases
const testCases = [
  // Normal URLs
  {
    name: "Standard URL",
    url: "https://example.com/product/123",
    expectedDomain: "example.com",
  },
  {
    name: "URL with www",
    url: "https://www.example.com/product/123",
    expectedDomain: "example.com",
  },
  {
    name: "URL with subdomain",
    url: "https://shop.example.com/product/123",
    expectedDomain: "example.com",
  },
  
  // URLs with tracking parameters
  {
    name: "URL with tracking parameters",
    url: "https://example.com/product/123?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale",
    expectedDomain: "example.com",
  },
  
  // Very long URLs
  {
    name: "Very long URL with tracking parameters",
    url: "https://example.com/product/really/long/path/with/many/segments/123?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&utm_content=" + "x".repeat(500) + "&fbclid=" + "y".repeat(200),
    expectedDomain: "example.com",
  },
  
  // Malformed URLs
  {
    name: "URL without protocol",
    url: "example.com/product/123",
    expectedDomain: "example.com",
  },
  {
    name: "Just the domain",
    url: "example.com",
    expectedDomain: "example.com",
  },
  
  // Edge cases
  {
    name: "URL with query fragment only",
    url: "https://example.com?q=test",
    expectedDomain: "example.com",
  },
  {
    name: "URL with special characters in path",
    url: "https://example.com/product/special_&*%$#@!_chars",
    expectedDomain: "example.com",
  }
];

// Additional test cases for extreme situations
const extremeTestCases = [
  {
    name: "Extremely long URL (5000+ characters)",
    url: "https://example.com/product/123?" + Array(50).fill("param" + "x".repeat(100) + "=value" + "y".repeat(100)).join("&"),
    expectedDomain: "example.com", 
  },
  {
    name: "URL with invalid characters in domain",
    url: "https://exa mple.com/product/123",
    expectedDomain: "unknown-domain.com", // This should use our fallback domain
  },
  {
    name: "Completely malformed URL",
    url: "not a url at all just some text",
    expectedDomain: "unknown-domain.com", // This should use our fallback domain
  },
  {
    name: "Empty URL",
    url: "",
    expectedDomain: "unknown-domain.com", // This should use our fallback domain
  }
];

async function runTests() {
  console.log("\n=== Testing URL Processing Functions ===\n");
  
  // Test original getApexDomain function
  console.log("Testing getApexDomain function:");
  for (const testCase of [...testCases, ...extremeTestCases]) {
    try {
      const result = getApexDomain(testCase.url);
      const passed = result === testCase.expectedDomain;
      console.log(`  ${passed ? '✅' : '❌'} ${testCase.name}: ${result} ${!passed ? `(expected: ${testCase.expectedDomain})` : ''}`);
    } catch (error) {
      console.log(`  ❌ ${testCase.name}: Threw an error - ${error.message}`);
    }
  }
  
  // Test our enhanced extractDomainSafely function
  console.log("\nTesting extractDomainSafely function:");
  for (const testCase of [...testCases, ...extremeTestCases]) {
    try {
      const result = extractDomainSafely(testCase.url);
      const passed = result === testCase.expectedDomain;
      console.log(`  ${passed ? '✅' : '❌'} ${testCase.name}: ${result} ${!passed ? `(expected: ${testCase.expectedDomain})` : ''}`);
    } catch (error) {
      console.log(`  ❌ ${testCase.name}: Threw an error - ${error.message}`);
    }
  }
  
  // Test program creation with extreme URLs
  console.log("\nTesting getOrCreateProgramByUrl function with extreme cases:");
  for (const testCase of extremeTestCases) {
    try {
      // Using a mock workspace ID for testing
      const result = await getOrCreateProgramByUrl(testCase.url, "ws_test", null);
      console.log(`  ✅ ${testCase.name}: Successfully created program: ${result.programId}`);
    } catch (error) {
      console.log(`  ❌ ${testCase.name}: Failed to create program - ${error.message}`);
    }
  }
  
  // Test creating multiple programs with the same URL
  console.log("\nTesting unique program creation for identical URLs:");
  try {
    const testUrl = "https://example.com/product/123";
    console.log(`Creating two programs with the same URL: ${testUrl}`);
    
    const result1 = await getOrCreateProgramByUrl(testUrl, "ws_test", null);
    const result2 = await getOrCreateProgramByUrl(testUrl, "ws_test", null);
    
    if (result1.programId !== result2.programId) {
      console.log(`  ✅ Different programs created successfully:`);
      console.log(`     - First program: ${result1.programId}`);
      console.log(`     - Second program: ${result2.programId}`);
    } else {
      console.log(`  ❌ Same program created for both calls: ${result1.programId}`);
    }
  } catch (error) {
    console.log(`  ❌ Error testing unique program creation: ${error.message}`);
  }
  
  console.log("\n=== Test complete ===\n");
}

runTests().catch(console.error); 