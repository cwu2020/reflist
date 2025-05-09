import { ProcessedLinkProps, WorkspaceProps } from "@/lib/types";
import { processLink } from "./process-link";
import { getDefaultPartnerForUser, ensurePartnerProgramEnrollment } from "./partner-enrollment";
import { isValidUrl } from "@dub/utils";
import { createId } from '@/lib/api/create-id';
import { prisma } from '@dub/prisma';

/**
 * Wrapper around processLink that adds partner functionality
 * - Automatically assigns the user's default partner to the link if no partnerId is specified
 * - Creates a program for the link's URL domain if none exists
 * - Enrolls the partner in the program
 * - Always ensures a program and partner are associated with the link
 * 
 * @param params The parameters to pass to processLink
 * @returns The result from processLink, potentially modified with partner data
 */
export async function processLinkWithPartner<T extends Record<string, any>>({
  payload,
  workspace,
  userId,
  ...rest
}: Parameters<typeof processLink>[0]): ReturnType<typeof processLink> {
  try {
    // First, process the link normally
    const result = await processLink({
      payload,
      workspace,
      userId,
      ...rest,
    });

    // If there was an error in the initial processing, return that error
    if (result.error) {
      return result;
    }

    // Get the processed link data
    const link = result.link as ProcessedLinkProps & T;
    
    // Only proceed with partner/program logic if we have a valid URL
    if (!link.url || !isValidUrl(link.url)) {
      return result;
    }

    try {
      // If no workspace or userId, we can't proceed with partner enrollment
      if (!workspace || !userId) {
        console.log("Missing workspace or userId for partner/program assignment");
        return result;
      }

      // If no partnerId is specified, try to get the user's default partner
      let partnerId = link.partnerId;
      try {
        if (!partnerId) {
          partnerId = await getDefaultPartnerForUser(userId);
        }
      } catch (partnerError) {
        console.warn("Could not get default partner, will create one:", partnerError);
        
        // Create a fallback partner if none exists
        try {
          const fallbackPartner = await prisma.partner.create({
            data: {
              id: createId({ prefix: "pn_" }),
              name: `User Partner ${userId.slice(-5)}`,
              email: null,
            }
          });
          
          // Connect this partner to the user
          await prisma.partnerUser.create({
            data: {
              userId,
              partnerId: fallbackPartner.id,
              role: 'owner'
            }
          });
          
          // Update user's default partner
          await prisma.user.update({
            where: { id: userId },
            data: { defaultPartnerId: fallbackPartner.id }
          });
          
          partnerId = fallbackPartner.id;
          console.log(`Created fallback partner: ${partnerId}`);
        } catch (createPartnerError) {
          console.error("Failed to create fallback partner:", createPartnerError);
          // Continue without partner if we can't create one
        }
      }
      
      // Check for ShopMy metadata
      const shopmyMetadata = link.shopmyMetadata || null;
      const originalUrl = link.originalUrl || null;
      
      // If we have ShopMy metadata, construct a complete metadata object
      const completeShopMyData = shopmyMetadata ? {
        ...shopmyMetadata,
        originalUrl: originalUrl
      } : null;
      
      // Get or create a program and enroll partner if we have a partnerId
      let programId = link.programId;
      if (partnerId) {
        try {
          programId = await ensurePartnerProgramEnrollment({
            url: link.url,
            workspaceId: workspace.id,
            partnerId,
            shopmyMetadata: completeShopMyData,
          });
        } catch (programError) {
          console.error("Failed to ensure partner program enrollment:", programError);
          // Continue without program if we can't create one
        }
      }
      
      // Return the enhanced link with partner and program IDs
      return {
        link: {
          ...link,
          partnerId: partnerId || null,
          programId: programId || null,
        },
        error: null,
      };
    } catch (error) {
      // If there's an error in the partner enrollment process, 
      // log it but still return the original processed link
      console.error("Error in partner/program assignment:", error);
      return result;
    }
  } catch (error) {
    // For any unexpected errors, return a generic error
    console.error("Unexpected error in processLinkWithPartner:", error);
    return {
      link: payload,
      error: "An unexpected error occurred while processing the link.",
      code: "internal_server_error",
    };
  }
} 