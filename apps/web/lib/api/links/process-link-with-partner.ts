import { ProcessedLinkProps, WorkspaceProps } from "@/lib/types";
import { processLink } from "./process-link";
import { getDefaultPartnerForUser, ensurePartnerProgramEnrollment } from "./partner-enrollment";
import { isValidUrl } from "@dub/utils";

/**
 * Wrapper around processLink that adds partner functionality
 * - Automatically assigns the user's default partner to the link if no partnerId is specified
 * - Creates a program for the link's URL domain if none exists
 * - Enrolls the partner in the program
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

    // If there was an error or the user isn't logged in, return the original result
    if (result.error || !userId || !workspace) {
      return result;
    }

    // Get the processed link data (should be error-free at this point)
    const link = result.link as ProcessedLinkProps & T;
    
    // Only proceed if we have a valid URL (skip this for _root redirects or similar)
    if (!link.url || !isValidUrl(link.url)) {
      return result;
    }

    // Don't modify links that already have a programId or partnerId set
    if (link.programId && link.partnerId) {
      return result;
    }

    try {
      // If no partnerId is specified, try to get the user's default partner
      const partnerId = link.partnerId || await getDefaultPartnerForUser(userId);
      
      // Ensure partner is enrolled in a program for this URL
      const programId = await ensurePartnerProgramEnrollment({
        url: link.url,
        workspaceId: workspace.id,
        partnerId,
      });
      
      // Return the result with updated partner and program IDs
      return {
        link: {
          ...link,
          partnerId,
          programId,
        },
        error: null,
      };
    } catch (error) {
      // If there's an error in the partner enrollment process, 
      // just log it and continue with the original link
      console.error("Error in partner enrollment:", error);
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