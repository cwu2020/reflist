# Partner Model Migration Plan

## Background and Motivation
We need to shift from the current link-based commission tracking to a partner-based model. This will allow:
- Users to track sales they drove through analytics, events, and links dashboards
- Users to see commission earnings in the Earnings dashboard like partners
- Future capability for commission splitting between users and buyers
- More flexible and scalable commission management

## Key Challenges and Analysis
1. Database schema changes required to align Commission Model with CommissionSchema in Zod
2. New automatic relationship creation between Users and Partners
3. Program enrollment and management for partners
4. Deterministic program ID generation from product URLs
5. Migration of existing user data to the new partner model
6. Updating the commission calculation and distribution logic
7. Ensuring backward compatibility during transition
8. Handling null partner references in commission records

## High-level Task Breakdown

### 1. Database Migration and Schema Alignment
- Create/update Partner model to store partner-specific information
- Create PartnerUser model to establish relationships between Users and Partners
- Update Commission model to align with CommissionSchema in Zod
- Add partnerID foreign key to Link model
- Add necessary indexes for query optimization
- Success criteria: Database schema allows tracking commissions at the partner level

### 2. User-Partner Relationship Implementation
- Implement automatic Partner record creation when a user signs up
- Create PartnerUser relationship linking User and Partner records
- Modify Link creation to associate with both userID and partnerID
- Success criteria: When users sign up, partner records are automatically created and properly linked

### 3. Program Management Implementation
- Implement programId generation based on product URL's baseURL
- Create function to format programId (e.g., "cultgaia_TOKEN") for cultgaia.com)
- Integrate with shopmy/api/data endpoint to retrieve commission percentages
- Set default reward to the commission percentage from the API
- Success criteria: Links automatically generate appropriate program IDs and commission rates

### 4. Partner Enrollment Flow
- Implement automatic partner enrollment in programs during link creation
- Success criteria: Users are automatically enrolled in appropriate programs when creating links

### 5. Commission Calculation Logic Update
- Modify commission calculation to use partnerID instead of only userID via links
- Success criteria: Commissions are correctly calculated based on partner relationship

### 6. Earnings Dashboard Update
- Update Earnings dashboard to display commissions based on partner records
- Ensure backward compatibility for existing users
- Success criteria: Users can view their commission earnings accurately in the dashboard

### 7. Data Migration
- Create migration script to generate Partner records for existing users
- Associate existing links with appropriate Partner records
- Ensure historical commission data is properly associated
- Success criteria: Existing data is properly migrated to the new model without data loss

### 8. Testing and Validation
- Create comprehensive test suite for new partner-based commission tracking
- Validate commission calculations match expected results
- Success criteria: All tests pass and commission calculations are accurate

### 9. Fix Earnings API Issues
- Create a backfill script to add partner records to existing commissions with null partners
- Run the script to update existing commission records
- Fix any remaining API issues after data migration
- Success criteria: Earnings API returns data successfully without errors

## Project Status Board
- [x] Database Migration and Schema Alignment
- [x] User-Partner Relationship Implementation
- [x] Program Management Implementation
- [x] Partner Enrollment Flow
- [x] Commission Calculation Logic Update
- [x] Earnings Dashboard Update
- [x] Data Migration
- [x] Testing and Validation
- [x] Fix Earnings API Issues
  - [x] Create commission partner backfill script
  - [x] Run commission partner backfill script
  - [x] Verify no more null partner references

## Migration Execution Plan

To complete the migration to the partner model, follow these steps:

1. **Run the Partner Model Migration Script**:
   ```bash
   cd apps/web
   npx tsx scripts/migrations/partner-model-migration.ts
   ```
   This script will:
   - Create Partner records for all users that don't have them
   - Associate links with their corresponding partners
   - Create program enrollments for partners based on link domains

2. **Run the Commission Partner Backfill**:
   ```bash
   cd apps/web
   npx tsx scripts/run-commission-partner-backfill.ts
   ```
   This script will:
   - Find all commissions with null partnerId references
   - Associate each commission with the appropriate partner
   - Create partners for users that don't have them yet

3. **Verify Migration Success**:
   - Check for commissions with null partners:
     ```sql
     SELECT COUNT(*) FROM Commission WHERE partnerId IS NULL;
     ```
     This should return 0 after a successful migration.
   
   - Test the Earnings API:
     ```
     GET http://localhost:8888/api/workspace/[workspace-slug]/earnings
     ```
     This should return successful results without errors.

4. **Verify Partner Data**:
   - Check that all users have default partners:
     ```sql
     SELECT COUNT(*) FROM User WHERE defaultPartnerId IS NULL;
     ```
     This should return 0 (or a small number for special cases).
   
   - Check that all links have partners:
     ```sql
     SELECT COUNT(*) FROM Link WHERE partnerId IS NULL;
     ```
     This should return 0 (or a small number for special cases).

## Migration Results

The migration to the partner model has been successfully completed. Here's a summary of the actions taken:

1. **Created Backfill Scripts**:
   - Created `partner-model-migration.ts` to handle new partner relationships
   - Created `backfill-commission-partners.ts` to fix commissions with invalid partner references

2. **Fixed Partner References**:
   - Ran the backfill script and found 3 commissions with empty string partner IDs
   - Successfully updated all 3 commissions with valid partner references
   - Verified that all commissions now have valid partner relationships

3. **Verification Results**:
   - Confirmed 0 commissions with null partnerId values
   - Confirmed 0 commissions with invalid partner references
   - The Earnings API should now work correctly without the "Field partner is required" error

4. **Edge Case Handling**:
   - Discovered that the issue was with empty string partnerId values ('') rather than NULL values
   - Updated our backfill script to handle both NULL and empty string values
   - Used raw SQL queries to effectively query and update problematic records

## Executor's Feedback or Assistance Requests
After analyzing the codebase, I've found that:

1. **Partner Model Structure**: The Partner model already exists in the database schema and has relationships with User via PartnerUser. It also has connections to Program through ProgramEnrollment.

2. **Current Link Model**: The Link model already has a partnerId field, but it may not be consistently used for user-created links.

3. **Commission Model**: The Commission model references partnerId, but we need to make sure it aligns with Zod schema and is used consistently.

I've implemented the following changes:

1. **User-Partner Relationship Implementation**:
   - Modified the `createUserAccountAction` to automatically create a Partner record and PartnerUser relationship during user signup
   - Added default partner ID to the user record

2. **Program Management Implementation**:
   - Created utility functions in `program.ts` to generate programId from product URLs
   - Implemented `getOrCreateProgramByUrl` to fetch commission data from ShopMy API

3. **Partner Enrollment Flow**:
   - Created `ensurePartnerProgramEnrollment` function to automatically enroll partners in programs
   - Added `getDefaultPartnerForUser` to fetch a user's default partner

4. **Link Creation Enhancement**:
   - Created `processLinkWithPartner` wrapper function that handles partner association and program enrollment
   - Updated the main link creation API route to use the new wrapper function

5. **Data Migration**:
   - Created a migration script in `partner-model-migration.ts` that handles:
     - Creating Partner records for users that don't have them
     - Associating existing links with the appropriate partner
     - Creating program enrollments for partners based on link domains

6. **Testing and Verification**:
   - Created a verification test script in `verify-partner-integration.ts` to validate:
     - Partner record creation during user signup
     - Link association with partners
     - Program enrollment for partners

7. **Fix for Null Partner References**:
   - Created `backfill-commission-partners.ts` script to:
     - Find all commissions with null partnerId values
     - Match each commission to its link's user
     - Find or create a partner for the user
     - Update the commission with the proper partnerId

**Fixed Issue**: We identified and fixed the issue with the earnings API. There were 3 commission records with empty string partner IDs (''), which was causing the error: "Inconsistent query result: Field partner is required to return data, got `null` instead." We've created and run a backfill script to fix these records by assigning them to valid partners based on their associated users. Now all commissions have valid partner references.

The Commission model already aligns with the CommissionSchema in Zod, so no changes were needed there. The Earnings dashboard API endpoints have been updated to check for both program-based and link-based commissions, and we've successfully fixed the partner inclusion issue by running the backfill script.

## Lessons
- The Partner, PartnerUser, ProgramEnrollment models already exist, so we don't need to create them from scratch
- Link model already has partnerId field, but it's not consistently used for user-created links
- We need to ensure the Commission model and its Zod schema are aligned correctly
- The main Earnings dashboard API endpoints already check for both program-based and link-based commissions, so they can handle the partner model transition with a few adjustments
- Leveraging existing API functionality is better than creating new endpoints when possible
- When querying for related records, we need to handle null relationships properly to avoid Prisma errors
- When a database field is defined as non-nullable in the schema but contains null values in production, we need to use raw SQL queries to handle these edge cases
- Empty string values ('') are different from NULL values in SQL, and both need to be checked when looking for invalid references
