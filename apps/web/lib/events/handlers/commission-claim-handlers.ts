import { Event, EventType, PhoneVerifiedEvent, UserCreatedEvent, LoginEvent } from '../types';
import { commissionClaimService } from '../../services/commission-claim-service';

/**
 * Handle the PHONE_VERIFIED event
 */
export async function handlePhoneVerified(event: PhoneVerifiedEvent) {
  // Only log phone verification and don't auto-claim
  if (event.userId) {
    console.log(`Received phone verified event for user ${event.userId} with phone ${event.phoneNumber}`);
    console.log(`Commissions will be shown to user in the UI for manual claiming`);
    
    // DO NOT automatically claim commissions here
    // This would bypass the user seeing their unclaimed commissions first
  } else {
    console.log(`Phone ${event.phoneNumber} verified but no user is logged in`);
  }
}

/**
 * Handle the USER_CREATED event
 */
export async function handleUserCreated(event: UserCreatedEvent) {
  // If phone number was provided during signup, claim commissions
  if (event.phoneNumber) {
    console.log(`Processing user created event for new user ${event.userId} with phone ${event.phoneNumber}`);
    
    try {
      // Claim commissions associated with this phone number
      const result = await commissionClaimService.claimCommissions({
        phoneNumber: event.phoneNumber,
        userId: event.userId
      });
      
      console.log(`Claimed ${result.claimedCount} commissions with total earnings ${result.totalEarnings}`);
    } catch (error) {
      console.error('Error handling user created event:', error);
    }
  }
}

/**
 * Handle the LOGIN event
 */
export async function handleLogin(event: LoginEvent) {
  // Check if the event has a phoneNumberPendingClaim
  if (event.phoneNumberPendingClaim) {
    console.log(`Received login event for user ${event.userId} with pending phone ${event.phoneNumberPendingClaim}`);
    
    // We'll only store the association between the user, partner, and phone number
    // The actual claiming should happen via the UI when the user clicks the "Claim" button
    try {
      // Only ensure the user is associated with the partner for this phone
      const partnerManagementService = await import('../../services/partner-management-service')
        .then(module => new module.PartnerManagementService());
      
      // Look up or create partner by phone
      let partnerId = event.partnerId;
      
      if (!partnerId) {
        const partner = await partnerManagementService.findPartnerByPhone(event.phoneNumberPendingClaim);
        if (partner) {
          partnerId = partner.id;
          console.log(`Found existing partner ${partnerId} for phone ${event.phoneNumberPendingClaim}`);
        }
      }
      
      if (partnerId) {
        // Ensure the user is associated with this partner
        const associated = await partnerManagementService.ensureUserAssociatedWithPartner(
          event.userId, 
          partnerId
        );
        
        if (associated) {
          console.log(`Successfully associated user ${event.userId} with partner ${partnerId}`);
          console.log(`User can now proceed to manually claim commissions in the UI`);
        } else {
          console.error(`Failed to associate user ${event.userId} with partner ${partnerId}`);
        }
      } else {
        console.log(`No partner found for phone ${event.phoneNumberPendingClaim}`);
      }
    } catch (error) {
      console.error("Error handling login event:", error);
    }
  } else {
    console.log(`Login event for user ${event.userId} has no pending phone verification to claim`);
  }
} 