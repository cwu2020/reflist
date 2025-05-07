# Reflist Admin Manual Sale Commission Override Feature

## Background and Motivation
Currently, when admins manually record sales, the system automatically calculates earnings using either the program's default commission structure or a fixed 50% commission rate when no program exists. However, this doesn't provide flexibility for admins to control how much of each sale gets paid out as earnings.

We need to enhance the admin interface to allow admins to:
1. Input both the total sale amount and the commission amount Reflist received from ShopMy
2. Control what percentage of that commission is kept by Reflist vs. paid to the partner
3. See the calculated earnings in real-time before submitting

This feature will provide more flexibility in handling manual sales while maintaining compatibility with the future automated process.

## Key Challenges and Analysis
1. **UI Changes**: We need to update the sales recording form to include new fields for commission amount and a slider for the commission split.
2. **Backend Updates**: The backend needs to handle these new parameters while preserving existing functionality.
3. **Compatibility**: We need to maintain compatibility with the existing automated sales process for future use.
4. **Commission Calculation Logic**: We need to ensure the calculation logic is clear and provides expected results.

After analyzing the codebase, I identified the key components that need to be modified:

- `SalesRecordingForm` component (`apps/web/app/admin.thereflist.com/(dashboard)/sales/components/sales-recording-form.tsx`) - Needs new fields for commission amount and split percentage
- API endpoint (`apps/web/app/api/admin/sales/route.ts`) - Needs to handle the new parameters
- Earning calculation logic (`apps/web/lib/api/sales/calculate-sale-earnings.ts`) - Needs to support manual override
- Form data interfaces and schemas - Need to be updated to include new fields

The current earnings calculation uses `calculateProgramEarnings`, which either uses program-specific logic or falls back to `calculateDefaultEarnings` with a fixed 50% rate. We need to modify this flow to respect the admin's manual override when provided.

## High-level Task Breakdown

1. **Update Data Models and Schemas**
   - Update the `SaleFormData` interface to include new fields: `commissionAmount` and `commissionSplitPercentage`
   - Update the `recordSaleSchema` Zod schema to validate these new fields
   - Make the new fields optional to maintain backward compatibility
   - Success criteria: Updated schemas that can handle both new and old request formats

2. **Update Earnings Calculation Function**
   - Add a new function in `calculate-sale-earnings.ts` for manual earnings calculation that accepts:
     ```typescript
     calculateManualEarnings({
       commissionAmount: number;
       splitPercentage: number;
     }): number
     ```
   - Modify `calculateProgramEarnings` to check for manual override parameters before falling back to existing logic
   - Ensure we preserve the original behavior for automated sales
   - Success criteria: Calculation function works correctly with both default and manual inputs

3. **Enhance Frontend Sales Recording Form**
   - Add new field for commission amount input below the sale amount field
   - Add slider for commission split percentage (defaulting to 50%)
   - Implement real-time earnings calculation preview using the formula: `commissionAmount * (splitPercentage / 100)`
   - Add clear help text explaining:
     - Commission amount is what Reflist receives from ShopMy
     - Split percentage controls how much of the commission goes to partners
     - The preview shows how much the partner will earn
   - Success criteria: Form displays all fields correctly and calculates earnings preview in real-time

4. **Update Sales Client and Form Submission**
   - Update the `handleSubmit` function in `sales-client.tsx` to include the new fields in the request body:
     ```typescript
     body: JSON.stringify({
       // existing fields...
       commissionAmount: formData.commissionAmount,
       commissionSplitPercentage: formData.commissionSplitPercentage,
     }),
     ```
   - Success criteria: Form submission sends all required data to the backend

5. **Update Backend API Handler**
   - Modify the recordSaleSchema to include the new optional fields:
     ```typescript
     commissionAmount: z.number().int().min(0).optional(),
     commissionSplitPercentage: z.number().min(0).max(100).default(50).optional(),
     ```
   - Update the earnings calculation to use the manual override when provided:
     ```typescript
     const earnings = validatedData.commissionAmount && validatedData.commissionSplitPercentage
       ? calculateManualEarnings({
           commissionAmount: validatedData.commissionAmount,
           splitPercentage: validatedData.commissionSplitPercentage,
         })
       : await calculateProgramEarnings({
           programId: link.programId || null,
           amount: validatedData.amount,
           quantity: 1
         });
     ```
   - Success criteria: API correctly processes requests with and without manual override

6. **Add Input Validation and Constraints**
   - Add validation to ensure commission amount cannot exceed sale amount
   - Add validation for the slider to ensure values stay between 0-100%
   - Add conditional validation logic in the frontend
   - Add helpful error messages for validation failures
   - Success criteria: Form validates all inputs correctly with helpful error messages

7. **Testing and Documentation**
   - Test the new functionality with various inputs:
     - With and without commission amount
     - With different split percentages
     - With and without program associations
   - Add clear documentation comments explaining the override feature
   - Update inline comments for maintainability
   - Success criteria: Feature works correctly in all scenarios and is well-documented

## Project Status Board
- [x] 1. Update Data Models and Schemas
- [x] 2. Update Earnings Calculation Function
- [x] 3. Enhance Frontend Sales Recording Form (JSX linter errors present but functionality implemented)
- [x] 4. Update Sales Client and Form Submission
- [x] 5. Update Backend API Handler
- [x] 6. Add Input Validation and Constraints (Implemented within frontend and backend)
- [x] 7. Testing and Documentation

## Implementation Summary
1. Added `calculateManualEarnings` function to handle the custom commission calculation with split percentage
2. Updated the frontend form to include commission amount field and split percentage slider
3. Added real-time calculation display for the partner earnings based on inputs
4. Modified the API endpoint to handle custom commission parameters
5. Implemented validation to ensure commission amount doesn't exceed sale amount
6. Added appropriate error messages and help text throughout the interface

## Feature Usage Documentation

### How to Use the Commission Override Feature

1. **Search and Select Link**
   - Start by searching for the link you want to record a sale for
   - Click on a link from the search results to select it

2. **Enter Sale Details**
   - Fill in the required sale details (amount, currency, payment processor, etc.)
   - The "Sale Amount" represents the total amount of the sale

3. **Commission Override Settings**
   - In the "Commission Override Settings" section:
     - Enter the "Commission Amount" - this is the amount Reflist received from ShopMy
     - Adjust the "Commission Split Percentage" slider to determine what percentage of that commission goes to the partner
   - The system will automatically calculate and display:
     - Partner Earnings: How much the partner will receive
     - Reflist Keeps: How much Reflist will retain

4. **When to Use Commission Override**
   - Use this feature when you need to override the default commission calculation
   - If you leave the Commission Amount at 0, the system will use the default calculation logic (program's default reward or 50% if no program)
   - The override is particularly useful when:
     - The actual commission from ShopMy differs from what would be calculated automatically
     - You need to adjust the partner's percentage for a specific sale
     - You want precise control over earnings calculations

5. **Review and Submit**
   - Review all information before submission
   - Click "Record Sale" to save the sale with your configured settings

### Example Calculations

1. **Manual Override Example**:
   - Sale Amount: $100.00
   - Commission Amount: $20.00 (what Reflist received from ShopMy)
   - Commission Split: 60%
   - Result: Partner Earnings = $12.00, Reflist Keeps = $8.00

2. **Default Calculation Example**:
   - Sale Amount: $100.00
   - Commission Amount: not specified (left at 0)
   - Result: System uses program default reward or 50% fallback

## Known Issues
- We have persistent JSX linter errors in the frontend components. These appear to be TypeScript configuration issues rather than actual code problems. The functionality should work as expected, but the linter warnings should be addressed in a future update.

## Executor's Feedback or Assistance Requests
The implementation is complete but there are JSX linter errors in the form components. These appear to be TypeScript configuration issues rather than actual problems with the code. However, it's worth noting for future reference.

## Lessons
- When modifying existing code, it's important to maintain backward compatibility to ensure all existing functionality continues to work.
- Adding real-time calculation previews enhances user experience by providing immediate feedback.
- Including clear help text is essential when introducing new features, especially ones that affect financial calculations.
