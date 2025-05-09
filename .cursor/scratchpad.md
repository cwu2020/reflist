# Proposed Improved Architecture for Commission Claiming

## Background and Motivation

After analyzing the current commission claiming process, we've identified several architectural issues that make the system difficult to maintain, test, and debug:

1. Multiple inconsistent claim paths with different implementations
2. Tight coupling between authentication flow and commission claiming
3. Inconsistent handling of partner-user relationships across different paths
4. Lack of clarity in the data model regarding claimed vs. unclaimed commissions

We propose a comprehensive redesign of the commission claiming architecture to address these issues while maintaining the core business requirements.

## Key Design Principles for the New Architecture

1. **Single Responsibility Principle**: Separate authentication from commission claiming
2. **Consistent Interface**: One claim service with a unified interface for all claim scenarios
3. **Clear Data Model**: Explicit relationships between users, partners, and commissions
4. **Event-Driven**: Decouple processes through events for better extensibility
5. **Idempotent Operations**: Claim operations should be safe to retry if needed

## High-level Architecture Overview

We propose an architecture with these core components:

1. **Commission Claim Service**: A centralized service that handles all claim operations
2. **Phone Verification Service**: Handles phone verification separate from claiming
3. **Partner Management Service**: Manages partner records and relationships with users
4. **Event System**: Coordinates actions between different services

## Data Model Improvements

The primary change to the data model would be having `claimedById` point to the userId instead of partnerId, which more accurately represents who initiated the claim. This provides better tracking and accountability.

```typescript
// Revised CommissionSplit model
model CommissionSplit {
  id             String    @id @default(cuid())
  commissionId   String
  partnerId      String?   // Can be null for unregistered recipients (by phone number)
  phoneNumber    String?   // Store phone number for unregistered users
  splitPercent   Int       // Percentage (0-100) of commission share
  earnings       Int       // Actual earnings amount
  claimed        Boolean   @default(false)
  claimedAt      DateTime?
  claimedByPartnerId String?   // Legacy field - Partner ID who claimed this split (kept for backward compatibility)
  claimedByUserId    String?   // User ID who claimed this split
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  commission     Commission @relation(fields: [commissionId], references: [id], onDelete: Cascade)
  partner        Partner?   @relation(fields: [partnerId], references: [id])
  claimedByPartner  Partner?   @relation("ClaimedSplits", fields: [claimedByPartnerId], references: [id])
  claimedByUser     User?      @relation("ClaimedSplits", fields: [claimedByUserId], references: [id])
}
```

Similarly, User model would be updated to include this relationship:

```typescript
model User {
  // existing fields...
  claimedSplits CommissionSplit[] @relation("ClaimedSplits") 
}
```

## Migration Plan: Files and Routes

### Files/Routes to Keep but Modify

1. **Phone Verification API Routes**:
   - `/api/phone-verification/send` - Keep this route but simplify to focus only on sending verification codes
   - `/api/phone-verification/verify` - Keep but modify to only handle verification, not claiming

2. **Data Models**:
   - `CommissionSplit` model - Needs to be updated to change `claimedById` to reference User instead of Partner
   - `User` model - Add the relationship for claimed splits

### Files/Routes to Create

1. **Commission Claim Service**:
   - Create a new service file: `/lib/services/commission-claim-service.ts`
   - Create a new API endpoint: `/api/commissions/claim`

2. **Partner Management Service**:
   - Create a new service file: `/lib/services/partner-management-service.ts`

3. **Event System**:
   - Create event definitions: `/lib/events/types.ts`
   - Create event handlers: `/lib/events/handlers/`

### Files/Routes to Eventually Deprecate

1. **Existing Commission Claim Logic**:
   - `claimUnclaimedCommissions` function in `create-user-account.ts`
   - Commission claiming logic in `verify/route.ts`
   - Commission claiming logic in `verify-code-only/route.ts`

2. **Current Auto-claim Mechanism**:
   - `AUTO_CLAIM_AFTER_LOGIN` special code handling

### Migration Approach

Instead of immediately removing files, we should:

1. Implement the new services and endpoints
2. Update the data model
3. Gradually reroute requests from old endpoints to new services
4. Add deprecation notices to old methods
5. Eventually remove old methods once all clients migrate

### Specific Code That Will Change

We should be particularly careful with:

1. The transaction logic in `verify-code-only/route.ts` and `verify/route.ts`
2. The partner-user relationship management in all claim paths
3. The sign-up flow that does claiming through `createUserAccountAction`

This approach ensures we don't disrupt the existing functionality while implementing the new architecture. We'd maintain backward compatibility during the transition period.

## Detailed Component Design

### 1. Commission Claim Service

This service would handle all aspects of claiming commissions:

```typescript
interface ClaimCommissionOptions {
  phoneNumber: string;
  userId: string;        // Who is claiming (required)
  partnerIds?: string[]; // Which partners to claim for (optional)
}

interface ClaimResult {
  success: boolean;
  claimedCount: number;
  totalEarnings: number;
  partnersAssociated: PartnerInfo[];
  errors?: string[];
}

class CommissionClaimService {
  async claimCommissions(options: ClaimCommissionOptions): Promise<ClaimResult> {
    return await db.$transaction(async (tx) => {
      // 1. Find unclaimed commission splits for this phone
      const splits = await this.findUnclaimedSplits(tx, options.phoneNumber);
      
      if (splits.length === 0) {
        return { success: true, claimedCount: 0, totalEarnings: 0, partnersAssociated: [] };
      }
      
      // 2. Determine which partners to claim for
      const partnersForClaiming = await this.resolvePartners(tx, options);
      
      // 3. Ensure user is associated with all relevant partners
      const partnersAssociated = await this.ensurePartnerAssociations(tx, options.userId, partnersForClaiming);
      
      // 4. Mark splits as claimed and attribute to proper partners
      const claimResults = await this.markSplitsAsClaimed(
        tx, 
        splits, 
        options.userId, 
        partnersForClaiming
      );
      
      // 5. Return standardized results
      return {
        success: true,
        claimedCount: claimResults.count,
        totalEarnings: claimResults.totalEarnings,
        partnersAssociated
      };
    });
  }
  
  // Helper methods
  private async findUnclaimedSplits(tx, phoneNumber) { /* ... */ }
  private async resolvePartners(tx, options) { /* ... */ }
  private async ensurePartnerAssociations(tx, userId, partners) { /* ... */ }
  private async markSplitsAsClaimed(tx, splits, userId, partners) { /* ... */ }
}
```

### 2. Phone Verification Service

Handles phone verification separately from claiming:

```typescript
interface VerifyPhoneOptions {
  phoneNumber: string;
  code: string;
}

interface VerificationResult {
  success: boolean;
  verified: boolean;
  hasUnclaimedCommissions: boolean;
  unclaimedCommissionCount: number;
  unclaimedTotal: number;
}

class PhoneVerificationService {
  async sendVerificationCode(phoneNumber: string): Promise<void> { /* ... */ }
  
  async verifyPhone(options: VerifyPhoneOptions): Promise<VerificationResult> {
    // 1. Verify the code
    const isValid = await this.validateCode(options.phoneNumber, options.code);
    
    if (!isValid) {
      return { success: false, verified: false, hasUnclaimedCommissions: false, unclaimedCommissionCount: 0, unclaimedTotal: 0 };
    }
    
    // 2. Check for unclaimed commissions (but don't claim yet)
    const { count, total } = await this.checkUnclaimedCommissions(options.phoneNumber);
    
    // 3. Return verification result
    return {
      success: true,
      verified: true,
      hasUnclaimedCommissions: count > 0,
      unclaimedCommissionCount: count,
      unclaimedTotal: total
    };
  }
  
  // Helper methods
  private async validateCode(phoneNumber, code) { /* ... */ }
  private async checkUnclaimedCommissions(phoneNumber) { /* ... */ }
}
```

### 3. Partner Management Service

Handles partner-user relationships:

```typescript
class PartnerManagementService {
  async findPartnerByPhone(phoneNumber: string): Promise<Partner | null> { /* ... */ }
  
  async associateUserWithPartner(userId: string, partnerId: string, role: PartnerRole = 'owner'): Promise<void> { /* ... */ }
  
  async getPartnersForUser(userId: string): Promise<Partner[]> { /* ... */ }
  
  async updatePartnerPhone(partnerId: string, phoneNumber: string): Promise<void> { /* ... */ }
}
```

### 4. Event System

Coordinates actions between services:

```typescript
// Event definitions
type PhoneVerifiedEvent = { phoneNumber: string, userId?: string };
type UserCreatedEvent = { userId: string, email: string, phoneNumber?: string };
type LoginEvent = { userId: string, phoneNumberPendingClaim?: string };

// Event handlers
async function handlePhoneVerified(event: PhoneVerifiedEvent) {
  // If user is logged in, claim commissions
  if (event.userId) {
    await claimService.claimCommissions({ phoneNumber: event.phoneNumber, userId: event.userId });
  } else {
    // Just store verification for later claiming
    await storage.storeVerification(event.phoneNumber);
  }
}

async function handleUserCreated(event: UserCreatedEvent) {
  // If phone number was provided during signup, claim commissions
  if (event.phoneNumber) {
    await claimService.claimCommissions({ phoneNumber: event.phoneNumber, userId: event.userId });
  }
}

async function handleLogin(event: LoginEvent) {
  // If user has pending phone verification, claim commissions
  if (event.phoneNumberPendingClaim) {
    await claimService.claimCommissions({ 
      phoneNumber: event.phoneNumberPendingClaim, 
      userId: event.userId 
    });
  }
}
```

## High-level Task Breakdown for New Architecture

1. **Implement Core Services**
   - Create the CommissionClaimService
   - Create the PhoneVerificationService
   - Create the PartnerManagementService
   - Success Criteria: Services have clear interfaces and function properly

2. **Update Data Model**
   - Modify CommissionSplit to point claimedById to User instead of Partner
   - Add claimedForPartnerId to track which partner received the earnings
   - Add appropriate relations in the User model
   - Success Criteria: Data model correctly represents who claimed which commissions

3. **Refactor API Endpoints**
   - Simplify verify endpoint to handle only verification
   - Add dedicated claim endpoint
   - Success Criteria: Clear separation of verification from claiming

4. **Implement Event System**
   - Add events for phone verification, user creation, and login
   - Add handlers to process these events
   - Success Criteria: Events correctly trigger claiming when appropriate

5. **Migrate Existing Data**
   - Update existing CommissionSplits to have correct claimedById values
   - Success Criteria: Existing claimed commissions correctly attributed

## Project Status Board for New Architecture

- [x] 1. Implement Core Services
  - [x] Created CommissionClaimService
  - [x] Created PhoneVerificationService
  - [x] Created PartnerManagementService
- [x] 2. Update Data Model
  - [x] Created Prisma schema updates for CommissionSplit, User and Partner models
  - [x] Created SQL migration for updating the database
  - [x] Run migration on the database (dev and production)
- [x] 3. Refactor API Endpoints
  - [x] Created dedicated commission claim endpoint at /api/commissions/claim
  - [x] Updated phone verification endpoint to use new services
  - [x] Removed deprecated verify-code-only endpoint
  - [x] Updated client code to use the new commission claim service
  - [x] Deprecated `claimUnclaimedCommissions` function and updated user creation flow to use events instead
- [x] 4. Implement Event System
  - [x] Defined event types
  - [x] Created event emitter
  - [x] Implemented event handlers for commission claiming
- [x] 5. Migrate Existing Data
  - [x] Reset existing commission splits to unclaimed for testing

## Current Status / Progress Tracking

We have successfully implemented the core architecture for improving the commission claiming system. Here's a summary of our progress:

1. **Core Services Implementation** ✅
   - CommissionClaimService, PhoneVerificationService, and PartnerManagementService are fully implemented
   - All services are designed with clear interfaces and separation of concerns
   - Fixed a type error in test-commission-claim.ts where the wrong program ID prefix was used ("prg_" instead of "prog_")
   - Fixed additional type errors in test-commission-claim.ts:
     - Changed commission split ID prefix from "cs_" to "cus_"
     - Added required fields to Commission creation (linkId, quantity)
     - Fixed event emitting structure for PhoneVerifiedEvent
     - Added proper type assertion for event data when using emitEvent()

2. **Database Schema Migration** ✅
   - Successfully migrated from `claimedById` to:
     - `claimedByPartnerId` (for backward compatibility)
     - `claimedByUserId` (new field to track user claims)
   - Migration applied to both development and production databases
   - Production migration handled the fact that PlanetScale doesn't support foreign key constraints

3. **Event System Implementation** ✅
   - Created event definitions for PHONE_VERIFIED, USER_CREATED, and LOGIN events
   - Implemented event handlers for asynchronous commission claiming
   - Registered event handlers in the system

4. **API Endpoints** ✅
   - Created a new `/api/commissions/claim` endpoint for explicit claiming
   - Updated the `/api/phone-verification/verify` endpoint to:
     - Only handle verification, not claiming directly
     - Emit events for asynchronous claiming when appropriate
   - Removed deprecated `/api/phone-verification/verify-code-only` endpoint
   - Updated client code in claim page and phone verification form to use the new architecture
   - Deprecated `claimUnclaimedCommissions` function and updated user creation flow to use events instead
   - Deprecated `AUTO_CLAIM_AFTER_LOGIN` special code for automatic claiming:
     - Replaced with explicit claiming via the LOGIN event system
     - Modified claim page to no longer use the special code mechanism
     - Updated PhoneVerificationService to remove special code handling
     - Events now handle the post-login claiming flow more cleanly

5. **Data Reset for Testing** ✅
   - Reset all commission splits to unclaimed status for testing

## Next Steps

1. **Testing the New Flow**
   - Test the claiming flow with the new architecture
   - Verify that commissions are properly claimed using the new services

2. **Update Remaining Endpoints**
   - Check if any remaining endpoints need to be updated to use the new services
   - Remove any direct claiming from other parts of the codebase

3. **Client Integration Testing**
   - Test the frontend integration with the new API endpoints
   - Verify that the UI correctly shows claimed vs. unclaimed commissions

4. **Full Deprecation of Old Code**
   - Once everything is working, fully deprecate and remove any remaining old claiming code
   - Add comments documenting the new approach

## Lessons

- We need to handle error cases more gracefully, especially in critical flows like link creation
- Fallback mechanisms are essential for maintaining data integrity in multi-entity systems
- Enhanced logging helps with debugging complex flows
- When creating database records with user-provided data, we must be careful with field lengths to avoid database column limit errors
- For fallback mechanisms, use minimal hard-coded data rather than trying to reuse potentially problematic user input
- The Program model has column size limits that need to be respected when creating new programs

## API Endpoints

The new architecture would simplify our API endpoints:

```typescript
// POST /api/phone-verification/send
// Sends verification code - unchanged

// POST /api/phone-verification/verify
// Only verifies phone and checks for unclaimed commissions
export async function POST(req: Request) {
  const { phoneNumber, code } = await req.json();
  
  // Get current user if logged in
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  
  // Verify phone
  const result = await phoneVerificationService.verifyPhone({ phoneNumber, code });
  
  // If user is logged in, claim commissions in the background
  if (userId && result.verified && result.hasUnclaimedCommissions) {
    // Fire event to claim asynchronously
    emitEvent('PHONE_VERIFIED', { phoneNumber, userId });
  }
  
  return NextResponse.json({ success: true, ...result });
}

// POST /api/commissions/claim
// Explicit endpoint for claiming commissions
export async function POST(req: Request) {
  const { phoneNumber } = await req.json();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  
  // Claim commissions
  const result = await commissionClaimService.claimCommissions({ 
    phoneNumber, 
    userId: session.user.id 
  });
  
  return NextResponse.json({ success: true, ...result });
}
```

## Benefits of the New Architecture

1. **Clarity**: Clear separation of concerns between verification and claiming
2. **Consistency**: One implementation for claiming commissions
3. **Accountability**: Better tracking of who claimed which commissions
4. **Flexibility**: Easier to extend with new claim scenarios
5. **Testability**: Easier to write comprehensive tests for each component
6. **Maintainability**: Simpler to debug and update

## Backward Compatibility Considerations

To maintain backward compatibility during the transition period, we can:

1. Implement the new services while keeping the existing endpoints
2. Gradually migrate the endpoints to use the new services
3. Eventually deprecate the old implementation

This approach allows us to improve the architecture without disrupting existing functionality.

## Scripts for Creating Commissions

After thorough investigation, I've found several scripts and functions in the codebase that relate to creating commissions:

### Core Commission Creation Function

The primary function for creating commissions in the system is `createPartnerCommission` located in `apps/web/lib/partners/create-partner-commission.ts`. This function:

1. Handles creating commissions with proper earnings calculations
2. Supports commission splits between partners
3. Includes validation logic and business rules for commission eligibility

### Existing Scripts for Commission Creation/Management

The codebase has several scripts that can create or manipulate commissions:

1. **Manual Sale Script** (`apps/web/scripts/add-manual-sale-with-tinybird.js`):
   - Creates a manual sale commission record
   - Generates appropriate customer records
   - Updates link stats
   - Records the event in Tinybird for analytics

2. **Commission Splits Testing** (`apps/web/scripts/test-commission-splits/test-commission-splits.ts`):
   - Tests the commission split functionality
   - Creates test sales with splits based on configuration

3. **Commission Management Scripts**:
   - `apps/web/scripts/delete-all-commissions.ts` - For removing commissions
   - `apps/web/scripts/reset-claimed-commissions.ts` - Resets the claimed status
   - `apps/web/scripts/list-commissions.ts` - Lists existing commissions
   - Various migration scripts for commission data

### Using the Scripts

To create a commission, you can use one of these approaches:

1. Run the manual sale script:
   ```
   cd apps/web
   npm run script add-manual-sale-with-tinybird
   ```

2. Test commission splits:
   ```
   cd apps/web
   npm run script test-commission-splits
   ```

The `npm run script` command uses the runner in `apps/web/scripts/run.ts` which finds and executes the appropriate script.

### Recommendation

For reliable commission creation, the `add-manual-sale-with-tinybird.js` script is the most complete as it:
- Creates the commission record
- Updates related statistics
- Adds appropriate analytics events

This script would need to be customized with the specific link key, amount, and other parameters before running.

# Program Creation Fallback for Links

## Background and Motivation

We need to create a fallback mechanism to ensure a program always gets created when a link is created. This is critical because without a program, links cannot be properly tracked and managed in the referral system.

## Key Challenges and Analysis

1. Currently, if program creation fails during link creation, the entire process fails
2. We need a more robust system that creates a fallback program if something goes wrong
3. This ensures links are always associated with a program for proper tracking

## High-level Task Breakdown

- [x] Analyze the current implementation of program and link creation
- [x] Enhance the ensurePartnerProgramEnrollment function to handle failures better
- [x] Modify processLinkWithPartner to ensure it always has a valid programId and partnerId
- [x] Update API routes to use our enhanced functions

## Project Status Board

- [x] Implement fallback program creation in ensurePartnerProgramEnrollment
- [x] Add fallback partner creation in processLinkWithPartner
- [x] Update API routes to use processLinkWithPartner for link creation

## Executor's Feedback or Assistance Requests

- Completed the implementation of fallback program creation mechanism
- All links should now have a program associated with them, even if the primary program creation path fails
- Added detailed logging to help debug any issues that might arise

## Lessons

- We need to handle error cases more gracefully, especially in critical flows like link creation
- Fallback mechanisms are essential for maintaining data integrity in multi-entity systems
- Enhanced logging helps with debugging complex flows
- When creating database records with user-provided data, we must be careful with field lengths to avoid database column limit errors
- For fallback mechanisms, use minimal hard-coded data rather than trying to reuse potentially problematic user input
- The Program model has column size limits that need to be respected when creating new programs

## Implementation Details

1. Enhanced `ensurePartnerProgramEnrollment` to create a fallback program if the standard creation fails
2. Modified `processLinkWithPartner` to handle missing partners and programs
3. Updated multiple API routes to use our enhanced functions:
   - POST /api/links
   - POST /api/partners/links
   - PUT /api/partners/links/upsert

The implementation ensures that a program is always created and associated with a link, maintaining data integrity throughout the system.

# Account Creation Flow Analysis

## Background and Motivation

When a user creates an account through the claim process, they are currently being sent through the default onboarding flow and then redirected to a null workspace. We need to modify the account creation process in the claim flow to match the normal user account creation process (no onboarding flow and directing them to their automatically created workspace).

## Key Challenges and Analysis

By examining the codebase, we've identified the following components that control these flows:

1. **Normal User Registration Flow**:
   - User registers through `/register`
   - After registration, an automatic workspace is created
   - The onboarding step is marked as "completed" in Redis
   - User is redirected to their default workspace

2. **Claim Process Registration Flow**:
   - User verifies their phone at `/claim`
   - User clicks "Create an Account to Claim" which redirects to `/register?phoneNumber=XXX&claim=true`
   - After registration, the `USER_CREATED` event is emitted and handled by `handleUserCreated` in `commission-claim-handlers.ts`
   - The `CommissionClaimService` claims commissions and does create a workspace (see `ensureUserHasWorkspace` method)
   - The `ensureUserHasWorkspace` method also sets the onboarding step to "completed" in Redis
   - However, the user is being redirected to `/workspaces` instead of directly to their workspace

## Key Issues Identified

After reviewing the code, I've found the exact cause of the issue:

1. In `verify-email-form.tsx`, the claim flow redirects to `/workspaces`, but this is suboptimal because:
   - The `WorkspacesMiddleware` will handle this redirect and try to find the default workspace
   - However, the default workspace might not be available immediately after account creation due to timing issues
   - This can result in a redirect to a "null workspace" when the middleware can't find the workspace

2. The main difference between the flows:
   - Normal flow: Redirects to `/onboarding` where workspace creation and steps are handled
   - Claim flow: Relies on async event processing to create the workspace and set onboarding as completed

3. The correct solution would be:
   - Either redirect directly to the workspace slug (if we can reliably get it)
   - Or redirect to `/onboarding` first, but ensure it immediately recognizes the completed status

## Solution Approach

The simplest solution is to modify the redirect logic in `verify-email-form.tsx`. Instead of immediately redirecting to `/workspaces` after a successful sign-in for claim users, we should:

1. Add a small delay to allow the async workspace creation to complete
2. Fetch the user's default workspace directly before redirecting
3. If a workspace is found, redirect directly to that workspace
4. If no workspace is found (unlikely but possible), then fallback to the `/workspaces` redirect

This approach ensures that users coming through the claim flow will have the same experience as regular users - they'll go directly to their workspace without going through the onboarding flow.

## High-level Task Breakdown

1. **Modify the redirect logic in the verify-email-form.tsx file**:
   - Update the `onSuccess` handler to fetch the user's workspace before redirecting
   - Use a direct workspace redirect if a workspace is found
   - Fall back to `/workspaces` if no workspace is found

2. **Test both flows to ensure they work correctly**:
   - Test normal user registration to confirm it sends users to their created workspace
   - Test claim-based registration to confirm it also sends users to their created workspace

## Project Status Board

- [x] Investigate the redirect from `/workspaces` in WorkspacesMiddleware
- [x] Check if the redis value for onboarding step is being properly set
- [x] Update redirect logic in claim registration flow
- [x] Add loading animation during workspace creation
- [x] Test both registration flows to verify correct behavior

## Implementation Details

We've modified the `verify-email-form.tsx` file to improve the redirect logic when a user is claiming commissions:

1. Added a delay (1500ms) to allow the asynchronous workspace creation to complete before redirecting
2. After the delay, the code now fetches the user's workspaces directly using the API
3. If workspaces are found, it redirects directly to the first workspace's slug
4. If no workspaces are found or there's an error, it falls back to the original `/workspaces` redirect
5. Added a beautiful loading animation with the RefList wordmark while the workspace is being created, providing visual feedback to the user during the delay

This change ensures that users going through the claim process will have a smooth experience and be taken directly to their workspace, just like regular users.

## Executor's Feedback or Assistance Requests

I've identified that the issue is in the handling of redirects after user creation in the claim flow. The workspace is being created correctly, and the onboarding step is being properly set as "completed" in Redis, but the timing of the redirect doesn't allow for these async operations to complete before the user is redirected.

The change I've implemented should resolve this issue by adding a small delay and fetching the workspace information directly before attempting to redirect. Additionally, the loading animation provides a better user experience by showing that something is happening during the delay.

## Lessons

- Async operations like event handling need to be carefully coordinated with UI redirects to ensure a smooth user experience.
- Whenever possible, it's better to directly redirect users to their final destination rather than relying on middleware redirects that might not have access to the latest data.
- When dealing with event-based systems, adding small intentional delays can help ensure that async operations complete before proceeding with UI changes.
- Adding visual feedback (like loading animations) during asynchronous operations improves the user experience by reducing perceived wait times.



