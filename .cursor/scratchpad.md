# Google OAuth State Parameter Issues

## Background and Motivation

The application's commission claim flow relies on the Google OAuth state parameter to pass context (partner ID and phone number) through the authentication flow. Currently, the state parameter is completely missing in callbacks for all users across all environments. This affects both new account creation via Google OAuth and sign-in functionality. The email/password account creation flow works, but sign-in is also struggling with callback issues.

An additional issue has been identified: partners are automatically created during email/password sign-up, but not during OAuth sign-up. This inconsistency could lead to problems when users try to perform actions that require a partner context.

## Key Challenges and Analysis

1. The state parameter is essential for maintaining context during the OAuth flow, particularly for:
   - Associating new users with the correct partner during account creation
   - Identifying which verified phone number should be used for commission claiming
   - Maintaining context through authentication redirects

2. When Google OAuth callbacks occur without the state parameter:
   - Users can still authenticate but lose the context of what they were trying to do
   - The system cannot automatically associate the user with the correct partner
   - Commission claiming cannot proceed automatically after authentication

3. The issue occurs in all environments (development, staging, production) and affects all users, suggesting:
   - It's not an environment-specific configuration issue
   - It's likely a core implementation problem with our OAuth flow
   - It could be related to NextAuth.js configuration, middleware, or how we're passing the state parameter

4. **[CLARIFIED INSIGHT] Google Passkey Verification Flow**:
   - We're not intentionally routing through YouTube - Google is using YouTube as part of its passkey verification service
   - The authentication flow involves multiple redirects controlled by Google (Google → passkey → YouTube → our site)
   - Google's use of YouTube for passkey verification appears to be dropping the state parameter
   - This is likely happening because Google's internal redirect chain doesn't preserve all parameters
   - Since this is Google's internal process, we have limited control over these intermediate redirects

5. **[NEW ISSUE] Partner Creation Inconsistency**:
   - Email/password sign-up automatically creates both a partner and a workspace
   - OAuth sign-up only creates a workspace but not a partner
   - This could lead to issues when users need to perform partner-dependent actions
   - The current fallback mechanism in processLinkWithPartner creates partners on-demand, which might lead to inconsistent behavior

## High-level Task Breakdown

1. **Document Google Authentication Flow**
   - Trace and document the complete Google authentication flow including passkey verification
   - Add logging to capture URL parameters at each accessible point
   - Verify if passkey verification is always triggered or only in certain circumstances
   - Success Criteria: Complete understanding of when and why Google uses YouTube for verification

2. **Test Authentication Without Passkeys**
   - Determine if disabling passkey verification is possible for our use case
   - Test standard Google OAuth without triggering passkey verification
   - Success Criteria: Establish if non-passkey flow preserves the state parameter

3. **Server-Side State Correlation**
   - Implement a server-side mechanism to correlate authentication attempts before and after Google flow
   - Use session cookies that persist independently of OAuth parameters
   - Success Criteria: Ability to recover context even when state parameter is lost

4. **Alternative Context Passing**
   - Implement alternative methods for passing claim context that don't rely on OAuth state
   - Use localStorage/sessionStorage with robust validation
   - Create server-side storage with secure tokens
   - Success Criteria: Context preservation despite state parameter loss in Google's flow

5. **NextAuth Configuration Optimization**
   - Review NextAuth configuration specific to Google provider
   - Research how NextAuth handles multi-step OAuth processes
   - Explore additional NextAuth options for state parameter handling
   - Success Criteria: Optimized configuration that maximizes likelihood of state preservation

6. **Add Partner Creation to OAuth Sign-up Flow**
   - Modify the NextAuth signIn event callback to create a partner for new OAuth users
   - Ensure the partner is properly associated with the user and set as default
   - Update the processLinkWithPartner function to first check for existing default partner
   - Success Criteria: Consistent partner creation across all authentication methods

## Project Status Board

- [ ] 1. Document Google Authentication Flow
  - [ ] Add logging at authentication initiation
  - [ ] Add logging at callback reception
  - [ ] Create visualization of the complete Google flow
  - [ ] Identify patterns around passkey verification triggers
- [ ] 2. Test Authentication Without Passkeys
  - [ ] Research Google OAuth settings for passkey configuration
  - [ ] Create test flow with standard OAuth (if possible)
  - [ ] Document results of non-passkey authentication
- [ ] 3. Server-Side State Correlation
  - [ ] Design pre-authentication session mechanism
  - [ ] Implement secure state storage before authentication
  - [ ] Create state retrieval after authentication completes
- [ ] 4. Alternative Context Passing
  - [ ] Implement enhanced localStorage approach with encryption
  - [ ] Create server-side token-based reference system
  - [ ] Modify claim flow to use the alternative context mechanism
- [ ] 5. NextAuth Configuration Optimization
  - [ ] Review NextAuth Google provider settings
  - [ ] Test modified provider configurations
  - [ ] Document optimal NextAuth settings for Google with passkeys
- [x] 6. Add Partner Creation to OAuth Sign-up Flow
  - [x] Create partner creation function for OAuth users
  - [x] Modify NextAuth signIn event to create partner for new users
  - [x] Update processLinkWithPartner to first check for existing partners
  - [ ] Test partner creation across different auth flows

## Current Status / Progress Tracking

Clarified insight: Google is automatically using YouTube as part of its passkey verification process - it's not something we've intentionally added to our authentication flow. This presents a challenge because Google's internal redirect chain through YouTube appears to be dropping the state parameter, and we have limited control over these Google-managed redirects.

New issue identified: Partners are automatically created during email/password sign-up but not during OAuth sign-up. We need to add partner creation to the OAuth flow for consistency and to prevent potential issues with partner-dependent functionality.

**Update**: We've successfully implemented partner creation for OAuth users by:
1. Creating a `createPartnerForUser` method in the PartnerManagementService
2. Modifying the NextAuth signIn event to create a partner for new users
3. Updating the processLinkWithPartner function to use the new partner creation method

This ensures consistent behavior across both authentication paths. The implementation includes proper checks to avoid duplicate partners and associates the user with the partner as the owner.

## Executor's Feedback or Assistance Requests

Now that we understand Google is controlling this multi-step flow through their passkey verification system, we should focus on implementing solutions that work around this limitation rather than trying to modify Google's behavior. The most promising approach is likely a server-side correlation system that doesn't rely on the OAuth state parameter being preserved.

Additionally, we should implement partner creation for OAuth users to ensure consistency with the email/password flow and prevent potential issues.

## Lessons

- When integrating with third-party authentication systems, we need to account for their internal redirect flows
- Google's passkey verification process adds complexity to the OAuth flow that can affect parameter preservation
- Server-side context storage before initiating OAuth flow is crucial for complex authentication scenarios
- We should minimize reliance on OAuth state parameters for critical application context when multiple redirects are involved
- Ensure consistent entity creation (partners, workspaces) across different authentication methods to avoid inconsistent behavior
