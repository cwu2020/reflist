import { prisma } from "@dub/prisma";
import { createId } from "../create-id";
import { Prisma, Partner } from "@dub/prisma/client";

/**
 * Finds a partner by phone number or creates a new one
 * 
 * @param phoneNumber The phone number to lookup or create a partner with
 * @param name Optional name for newly created partners
 * @returns The existing or newly created partner
 */
export async function getOrCreatePartnerByPhone(
  phoneNumber: string,
  name: string = "Unknown Partner"
): Promise<Partner> {
  if (!phoneNumber) {
    throw new Error("Phone number is required to lookup or create a partner");
  }

  try {
    // Format phone number (remove spaces, dashes, etc.)
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    // We need to use a raw query since the Prisma client doesn't know about the phoneNumber field yet
    // First check if partner exists
    const existingPartners = await prisma.$queryRaw<Partner[]>`
      SELECT * FROM Partner WHERE phoneNumber = ${formattedPhoneNumber} LIMIT 1
    `;
    
    // If partner exists, return it
    if (existingPartners && existingPartners.length > 0) {
      return existingPartners[0];
    }
    
    // Otherwise, create a new partner with the phone number
    // We need to use Prisma.validator to include the phoneNumber field
    const partnerData = {
      id: createId({ prefix: "pn_" }),
      name,
      status: "default",
      profileType: "individual",
      showOnLeaderboard: true,
      phoneNumber: formattedPhoneNumber
    } as Prisma.PartnerCreateInput;
    
    const partner = await prisma.partner.create({
      data: partnerData
    });
    
    return partner;
  } catch (error) {
    console.error("Error in getOrCreatePartnerByPhone:", error);
    throw error;
  }
}

/**
 * Formats a phone number by removing non-numeric characters except for leading +
 * 
 * @param phoneNumber The phone number to format
 * @returns Formatted phone number
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Keep the leading + if it exists
  if (phoneNumber.startsWith('+')) {
    return '+' + phoneNumber.substring(1).replace(/[^0-9]/g, '');
  }
  
  // Otherwise just remove non-numeric characters
  return phoneNumber.replace(/[^0-9]/g, '');
} 