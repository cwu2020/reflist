# Adding Phone Numbers to Partner Model for Commission Splits

## Background and Motivation

Currently, the partners model does not include phone numbers as a field. We want to enhance the system to support commission splits by phone number, allowing users to:
1. Add their phone numbers during signup
2. Create default partner records associated with their phone numbers
3. Split commissions with partners using phone numbers
4. Automatically attribute earnings to the right partners when commissions are split

This enhancement will improve the user experience for commission splits, making it easier for users to share commissions with partners who may not yet be registered in the system.

## Key Challenges and Analysis

1. **Schema Updates**:
   - Need to add phone_number field to Partner model
   - Need to ensure phone numbers are properly formatted and unique
   - May need to handle international phone numbers correctly

2. **User Signup Flow**:
   - Update signup to collect phone number (optional now, required later)
   - Create default partner IDs associated with phone numbers

3. **Commission Split Logic**:
   - Currently handles splits by partner ID
   - Need to add support for phone number-based splits
   - Need to handle cases where the phone number doesn't match any existing partner

4. **Partner Lookup and Creation**:
   - Implement lookup by phone number
   - Create new partner records for unrecognized phone numbers
   - Ensure these can be claimed later when users with matching phone numbers register

## High-level Task Breakdown

1. **Schema Update for Partner Model**
   - Add `phoneNumber` field to Partner model (nullable, unique)
   - Create migration script to update the database
   - Update Partner Zod schema
   - Success Criteria: Partner model has phoneNumber field and migrations run successfully

2. **Update User Signup Flow**
   - Modify user registration form to include optional phone number field
   - Update backend validation for user registration
   - When creating default partner for a new user, associate phone number
   - Success Criteria: New users can register with a phone number, and this gets associated with their default partner ID

3. **Update Commission Split Interface**
   - Modify the commission split UI to accept either partner ID or phone number
   - Update validation to handle both inputs
   - Success Criteria: Users can enter either partner ID or phone number when creating commission splits

4. **Implement Partner Lookup by Phone Number**
   - Create API to lookup partners by phone number
   - Handle formatting and normalization of phone numbers
   - Success Criteria: System correctly identifies partners by their phone numbers

5. **Implement Auto-creation of Partners for Unknown Phone Numbers**
   - Modify commission split logic to create a new partner record when phone number doesn't match existing partner
   - Set appropriate default values for auto-created partners
   - Success Criteria: When a commission is split with an unknown phone number, a new partner record is created

6. **Link Auto-created Partners with User Accounts**
   - When a user registers with a phone number that matches an auto-created partner, associate the partner with the user
   - Update the user's default partner ID if needed
   - Success Criteria: When a user registers with a phone number that was previously used in a commission split, they can see those earnings in their dashboard

7. **Testing and Validation**
   - Test all scenarios: existing partner phone number, new phone number, etc.
   - Verify commission split calculations
   - Verify earnings attribution
   - Success Criteria: All test cases pass, commissions are correctly attributed

## Project Status Board

- [x] 1. Schema Update for Partner Model
- [ ] 2. Update User Signup Flow
- [ ] 3. Update Commission Split Interface
- [x] 4. Implement Partner Lookup by Phone Number
- [x] 5. Implement Auto-creation of Partners for Unknown Phone Numbers
- [ ] 6. Link Auto-created Partners with User Accounts
- [ ] 7. Testing and Validation

## Current Status / Progress Tracking

We've successfully completed the schema updates by:
1. Adding the phoneNumber field to the Partner model in partner.prisma
2. Updating the Zod schema to include phoneNumber validation
3. Pushing the changes to both the combined.prisma file and the database
4. Implementing the getOrCreatePartnerByPhone function to handle lookup and creation of partners by phone number

Next steps would be to implement the user signup flow changes to collect phone numbers and update the commission split interface.

## Executor's Feedback or Assistance Requests

The phoneNumber field has been successfully added to the Partner model and the database schema has been updated. We've implemented a function to get or create partners by phone number.

To handle the fact that the Prisma client doesn't automatically recognize the new field, we used a raw SQL query for lookup and type assertion for creation. This approach works, but when the Prisma client is regenerated with the updated schema, we should revisit the implementation to use the standard Prisma methods.

## Lessons

- Read files before editing them
- Include debug info in program output
- Run npm audit for any vulnerabilities
- Ask before using git force commands
- When adding new fields to a Prisma model, you need to update both the schema file and the combined.prisma file
- Partner IDs use the "pn_" prefix

# Testing Commission Splits with a Simple TypeScript Script

## Background and Motivation

We need to test the commission splits functionality in isolation to ensure it's working correctly. The current script (`add-manual-sale-with-tinybird.js`) is in JavaScript, includes Tinybird event tracking, and contains more complexity than needed for basic testing. We'll create a simplified TypeScript version that focuses specifically on testing the commission splits functionality.

## Key Challenges and Analysis

1. **TypeScript Conversion**:
   - Convert existing JavaScript code to TypeScript
   - Add proper type definitions for all entities
   - Handle prisma client initialization correctly

2. **Commission Split Testing**:
   - Focus on creating a link with commission splits
   - Test the `createPartnerCommission` function directly
   - Verify that commission splits are correctly processed

3. **Simplifying the Script**:
   - Remove Tinybird event tracking
   - Focus only on the core functionality
   - Make it easier to configure test parameters

## High-level Task Breakdown

1. **Create a Basic TypeScript Script Structure**
   - Set up a TypeScript file with proper imports
   - Create proper type definitions
   - Initialize Prisma client
   - Success Criteria: Script compiles with TypeScript

2. **Implement Link Lookup Logic**
   - Add functionality to find an existing link by key or ID
   - Add option to create a test link with commission splits if needed
   - Success Criteria: Script can locate or create a test link with commission splits

3. **Implement Sale Creation Logic**
   - Create a customer or use an existing one
   - Set up a sale with a specified amount
   - Success Criteria: Script can create a sale record associated with a link

4. **Implement Direct Commission Split Testing**
   - Call the `createPartnerCommission` function directly
   - Pass in the link with commission splits
   - Success Criteria: Function properly processes commission splits

5. **Add Results Verification**
   - Query the database to verify that commission splits were created
   - Check that the earnings were properly calculated and distributed
   - Success Criteria: Script verifies that commission splits are working correctly

6. **Add Flexible Configuration**
   - Allow configuring test parameters (amount, split percentages, etc.)
   - Allow running different test scenarios
   - Success Criteria: Script can be easily configured for different test cases

## Project Status Board

- [ ] 1. Create a Basic TypeScript Script Structure
- [ ] 2. Implement Link Lookup Logic
- [ ] 3. Implement Sale Creation Logic
- [ ] 4. Implement Direct Commission Split Testing
- [ ] 5. Add Results Verification
- [ ] 6. Add Flexible Configuration

## Implementation Details

The script will:
1. Import the necessary dependencies:
   - PrismaClient
   - createPartnerCommission function
   - Types for Commission, Link, etc.

2. Create a configuration object to easily modify test parameters:
   - Link key or ID to use
   - Sale amount
   - Commission splits to test
   - Event type (sale)

3. Provide options to either:
   - Use an existing link with commission splits
   - Create a new link with commission splits for testing

4. Create a test sale and invoke the createPartnerCommission function:
   - Create a test customer if needed
   - Create a sale event
   - Call the createPartnerCommission function

5. Verify the results:
   - Query the database for created commission records
   - Check that splits were created with correct values
   - Display summary of results

## Success Criteria

The script will be considered successful if:
1. It runs without errors
2. It creates a sale with the specified amount
3. It properly calls the createPartnerCommission function
4. It verifies that commission splits were created correctly
5. It displays detailed logs of the process for debugging

## Next Steps

Once the script is created, we'll be able to:
1. Test different commission split scenarios
2. Debug any issues with the commission split functionality
3. Verify that the phone number-based partner lookup is working correctly

## Lessons

- Make sure to properly type all entities for better TypeScript support
- Keep test scripts focused on a single functionality
- Include detailed logging to help debug issues
- Make test scripts configurable to support multiple test scenarios



