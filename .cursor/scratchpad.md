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



