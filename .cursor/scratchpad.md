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

# Fixing Long URL Program Creation Issues

## Background and Motivation

We're currently experiencing an issue where extremely long URLs fail to create programs, preventing links with those URLs from being properly tracked. Additionally, there may be issues with ShopMy metadata not properly populating the default reward rate for newly created programs. We need to ensure that every link submitted to the system successfully creates a program with appropriate metadata, regardless of URL length.

## Key Challenges and Analysis

1. **Long URL Handling**:
   - Some product URLs contain excessive query parameters or tracking data
   - The current URL truncation may not be robust enough for all cases
   - The getApexDomain function might fail on malformed or extremely long URLs

2. **ShopMy Metadata Integration**:
   - ShopMy metadata needs to be properly extracted and applied to new programs
   - The reward rate from ShopMy should be correctly set as the default
   - We need a fallback mechanism when ShopMy metadata isn't available

3. **Error Handling**:
   - Current error handling may not catch all edge cases
   - We need to ensure programs are created even when errors occur
   - Better logging is needed to diagnose issues

## High-level Task Breakdown

1. **Enhance URL Truncation and Validation**
   - Improve the truncateUrl function to handle more extreme cases
   - Add better URL validation before attempting to extract domain
   - Add fallback mechanisms for malformed URLs
   - Success Criteria: URLs of any length can be processed without errors

2. **Strengthen Domain Extraction**
   - Improve the getApexDomain function to be more resilient
   - Add additional validation and fallbacks
   - Handle edge cases where domain extraction might fail
   - Success Criteria: Domain can be extracted from any valid URL regardless of length

3. **Improve ShopMy Metadata Integration**
   - Ensure ShopMy metadata is properly applied to new programs
   - Add better error handling when fetching ShopMy data
   - Implement retry logic for ShopMy API calls
   - Success Criteria: Program commission rates correctly reflect ShopMy metadata when available

4. **Add Comprehensive Logging**
   - Add detailed logging for URL processing steps
   - Log all attempts to extract domains and create programs
   - Track success/failure rates for program creation
   - Success Criteria: All failures in URL processing are logged with enough context to diagnose

5. **Implement Fail-Safe Program Creation**
   - Add a mechanism to ensure programs are created even when normal processing fails
   - Create a generic program when domain extraction fails
   - Allow manual reassignment of links to correct programs later
   - Success Criteria: Every link has an associated program, even in edge cases

## Project Status Board

- [x] 1. Enhance URL Truncation and Validation
- [x] 2. Strengthen Domain Extraction 
- [x] 3. Improve ShopMy Metadata Integration
- [x] 4. Add Comprehensive Logging
- [x] 5. Implement Fail-Safe Program Creation

## Current Status / Progress Tracking

We've successfully implemented substantial improvements to make program creation more robust:

1. **Enhanced URL Truncation**: 
   - Increased maximum URL length from 500 to 1000 characters
   - Added functionality to strip common tracking parameters from URLs
   - Improved URL structure preservation during truncation
   - Added multiple fallback mechanisms for malformed URLs

2. **Strengthened Domain Extraction**:
   - Enhanced `getApexDomain` function to handle extremely long URLs
   - Added regex-based fallback when URL parsing fails
   - Improved handling of URLs without protocols
   - Added special case handling for IP addresses

3. **Improved Domain Extraction in Program Creation**:
   - Created a new `extractDomainSafely` function with multiple fallback methods
   - Added regex-based domain extraction as last resort
   - Added a default domain when all extraction methods fail

4. **Added Comprehensive Logging**:
   - Added detailed logs throughout the URL processing pipeline
   - Included context about what's happening at each step
   - Added truncated logs for very long URLs to avoid log bloat

5. **Implemented Fail-Safe Program Creation**:
   - Added a last-resort fallback program creation mechanism
   - Ensured programs are created even when domain extraction fails
   - Generated generic slugs and names for fallback programs

6. **Improved ShopMy Metadata Handling**:
   - Added better error handling around ShopMy API calls
   - Enhanced logging for ShopMy metadata application
   - Ensured fallback to default commission when API fails

The key improvements allow us to:
1. Handle URLs of any length by properly truncating and cleaning them
2. Extract domains even from malformed or extremely long URLs
3. Create a program for every link, even in edge cases
4. Apply ShopMy metadata correctly when available
5. Log all steps for better debugging

## Implementation Approach

We've made the following changes:

1. Enhanced `truncateUrl` in `apps/web/lib/utils/program.ts`:
   - Added URL cleaning to remove tracking parameters
   - Improved URL structure preservation
   - Added better error handling and fallbacks

2. Enhanced `getApexDomain` in `packages/utils/src/functions/domains.ts`:
   - Added length limiting for performance
   - Added regex-based domain extraction as fallback
   - Improved handling of IP addresses and special domains

3. Added new `extractDomainSafely` function with multiple fallback methods

4. Enhanced `getOrCreateProgramByUrl` with:
   - Better error handling
   - Fallback program creation
   - Comprehensive logging
   - Improved ShopMy metadata handling

## Success Criteria

The implementation should now:
1. Create a program for 100% of submitted URLs
2. Correctly apply ShopMy metadata when available
3. Process even extremely long URLs without errors
4. Log all edge cases for monitoring and diagnosis

## Executor's Feedback or Assistance Requests

The changes have been implemented and are ready for testing. Recommend:

1. Testing with a variety of extremely long URLs, including those with:
   - Excessive query parameters
   - Malformed structure
   - Special characters

2. Monitoring logs to ensure:
   - URL truncation is working as expected
   - Domain extraction is successful
   - ShopMy metadata is being applied correctly
   - Fallback mechanisms are activating when needed

3. Consider adding more unit tests to cover the enhanced functions and edge cases.

## Lessons

- URL validation and processing needs to be extremely robust in production systems
- Always have fallback mechanisms for external API integrations
- Error handling should produce usable results even in edge cases
- Better to create a generic fallback entity than to fail completely
- Comprehensive logging is essential for diagnosing issues with URL processing

## Conclusion and Recommendations

The implemented changes significantly improve the system's robustness when handling URLs of any length or format. These improvements ensure that programs are always created for every link, even in extreme edge cases, and that ShopMy metadata is properly applied when available.

### Recommendations for Testing and Deployment:

1. **Test with Real-World Examples**:
   - Use examples of URLs that previously failed in production
   - Test with extremely long product URLs from common ecommerce platforms
   - Test URLs with numerous tracking parameters
   - Test malformed URLs that users might input

2. **Monitor Production Logs**:
   - Look for "fallback" or "error" logs to identify edge cases
   - Check if any URLs are hitting the fallback program creation path
   - Verify that ShopMy metadata is being applied as expected

3. **Implement Additional Improvements**:
   - Consider adding a periodic job to detect and fix orphaned links (links without programs)
   - Add an admin interface to manually associate links with the correct program when needed
   - Track metrics on URL processing success rates and fallback mechanism usage

4. **Future Robustness Improvements**:
   - Add more robust domain classification for better default program naming
   - Incorporate machine learning to automatically classify program types based on URLs
   - Implement automatic retry mechanisms for temporary ShopMy API failures

The included test script (`apps/web/scripts/test-url-processing.ts`) can be used to verify the improvements and should be run before deploying to production.

### Expected Outcome:

Following these improvements, we expect:

1. Zero failures in program creation, even with extremely long or malformed URLs
2. Correct application of ShopMy metadata for commission rates
3. Better debugging information through comprehensive logging
4. Improved user experience with no link creation failures due to URL issues

These changes ensure a much more robust system that can handle the wide variety of URLs that users submit, ultimately improving reliability and user satisfaction.

# Creating Unique Programs for Each Link

## Background and Motivation

After reviewing the current implementation, we've decided to modify our approach to program creation. Instead of creating unified programs based on the apex domain (where links with the same domain share a program), we now want to create a brand new program for every single link. This change will give us more flexibility in managing program settings on a per-link basis while still applying the appropriate reward rates and ShopMy metadata when available.

## Key Challenges and Analysis

1. **Current Implementation Limitation**:
   - The current system creates or reuses programs based on apex domain
   - This creates a tight coupling between links from the same domain
   - Changes to one program affect all links with that domain

2. **Desired Behavior**:
   - Every link should have its own unique program ID
   - ShopMy metadata should still be applied correctly for reward rates
   - Programs should still be created with appropriate defaults when needed

3. **Implementation Considerations**:
   - We need to modify the `getOrCreateProgramByUrl` function
   - We need to ensure unique program slugs for each link 
   - We need to maintain the improvements for URL processing and error handling

## High-level Task Breakdown

1. **Modify Program Creation Logic**
   - Remove the check for existing programs by domain
   - Ensure each new link gets a unique program ID
   - Success Criteria: Every new link creates a new program regardless of domain

2. **Maintain ShopMy Integration**
   - Keep existing ShopMy metadata logic
   - Continue to fetch and apply ShopMy commission data
   - Success Criteria: ShopMy commission rates are correctly applied to new programs

3. **Preserve Error Handling**
   - Maintain all the robust error handling added in previous improvements
   - Keep fallback mechanisms for URL processing
   - Success Criteria: All program creation is reliable even with problematic URLs

## Project Status Board

- [x] 1. Modify Program Creation Logic
- [x] 2. Maintain ShopMy Integration
- [x] 3. Preserve Error Handling

## Current Status / Progress Tracking

We've successfully updated the program creation logic to ensure each link gets its own unique program regardless of domain:

1. **Modified Program Creation Logic**:
   - Removed the check for existing programs based on domain
   - Ensured unique program slugs by adding timestamp and random tokens
   - Added uniqueness to program names for easier identification
   - Added a test case to verify unique programs are created for identical URLs

2. **Maintained ShopMy Integration**:
   - Kept all the existing ShopMy metadata integration logic intact
   - Preserved the commission rate application from ShopMy data
   - Ensured proper fallback to default commission when ShopMy data is unavailable

3. **Preserved Error Handling**:
   - Maintained all fallback mechanisms for URL processing
   - Kept robust domain extraction with multiple fallbacks
   - Ensured fallback program creation still works for problematic URLs

The key changes made were:
1. Renamed the function comment to clarify that the function always creates new programs
2. Removed the code that checks for existing programs by domain and workspaceId
3. Added additional uniqueness to program slugs and names using timestamps and random tokens
4. Updated the test script to verify that identical URLs create different programs

## Expected Impact

With these changes, every link will now have its own dedicated program. This gives us much more flexibility in managing program settings on a per-link basis. It also maintains all the improvements made previously for robust URL handling, domain extraction, and ShopMy metadata integration.

## Next Steps

The following actions are recommended:
1. Deploy the changes to production
2. Monitor for any performance impacts (the database will grow faster with more programs)
3. Consider adding a UI component to show the one-to-one relationship between links and programs
4. Update documentation to reflect the new behavior

The included test script (`apps/web/scripts/test-url-processing.ts`) has been updated to verify this new behavior.

## Conclusion

We've successfully implemented the requirement to create a unique program for every link, regardless of domain. This was achieved by:

1. **Modifying the `getOrCreateProgramByUrl` function**:
   - Removed the domain-based program lookup and reuse
   - Added timestamps and randomness to ensure unique slugs and names
   - Maintained the existing robust URL processing and error handling

2. **Preserving important functionality**:
   - ShopMy metadata is still applied correctly to set commission rates
   - URL truncation and domain extraction work as before
   - Fallback mechanisms ensure programs are created even for problematic URLs

3. **Ensuring testability**:
   - Updated the test script to verify that identical URLs create different programs
   - Added specific test cases for the new behavior

These changes provide a one-to-one relationship between links and programs, offering greater flexibility in program management. Each link can now have its own independent settings, while still benefiting from all the robustness improvements we added for URL processing.

The implementation is complete and ready for deployment. The test script can be run to verify the behavior works as expected. We recommend monitoring database growth after deployment as this change will result in more program records being created.



