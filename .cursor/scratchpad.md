# Enabling Link Deletion with Program Association

## Background and Motivation
Users currently cannot delete links from their dashboards if these links are associated with programs. When a user attempts to delete such links, the operation fails without a clear explanation. The goal is to modify the system to allow users to delete links associated with programs and have the corresponding programs deleted as well, ensuring database integrity while improving the user experience.

## Key Challenges and Analysis
1. The current implementation blocks deletion of links with a `programId` in the bulk delete endpoint.
2. The UI doesn't properly inform users why they can't delete certain links.
3. We need to implement a cascade delete that maintains database integrity.
4. The user interface should clearly communicate the capability to delete links.
5. Links with Commission records cannot be deleted to preserve financial records.
6. Programs have relationships with Reward and Discount models that need to be handled before deletion.

## High-level Task Breakdown
1. [x] **Remove program link restriction in delete API**
   - Success criteria: The API no longer filters out links with `programId` when querying for deletion
   - Modify the bulk delete API route to remove `programId: null` filter

2. [x] **Implement cascade delete functionality**
   - Success criteria: When a link with associated program is deleted, the program is also deleted
   - Modify database operations to include deletion of associated programs

3. [x] **Update UI to properly inform users**
   - Success criteria: Users get clear feedback about what happens when deleting links with programs
   - Add informational text to the delete confirmation dialog

4. [x] **Handle Commission relationship constraints**
   - Success criteria: Links with commissions are prevented from being deleted with a clear explanation
   - Add validation to check for commissions and disable delete buttons with an informative tooltip

5. [x] **Handle Program relationship constraints**
   - Success criteria: Programs with associated rewards can be deleted without constraint errors
   - Modify code to clear reward relationships before deleting programs

6. [ ] **Test deletion functionality**
   - Success criteria: Links with associated programs can be deleted, and the programs are also deleted
   - Links without programs continue to work as before
   - Links with commissions cannot be deleted and users see a clear explanation
   - Database remains in a consistent state

## Project Status Board
- [x] Modify the bulk delete API endpoint
- [x] Implement cascade deletion for programs
- [x] Update delete confirmation UI
- [x] Remove UI blocks that prevent deleting links with programs
- [x] Handle Commission relationship constraints
- [x] Prevent UI from allowing deletion of links with commissions
- [x] Handle Program-Reward relationships
- [ ] Test deletion of links with programs
- [ ] Test deletion of links without programs
- [ ] Document changes for users

## Current Status / Progress Tracking
I've made the following changes:

1. Removed the `programId: null` filter from the bulk delete API endpoint in `/apps/web/app/api/links/bulk/route.ts`
2. Added `program: true` to the `include` statement in the link query to ensure program data is available for cascade deletion
3. Implemented cascading deletion of programs when their associated links are deleted
4. Updated the delete link modal to inform users when they are deleting links with associated programs
5. Updated the success toast to include information about deleted programs
6. Fixed the UI restrictions that were preventing users from deleting links with programs:
   - In `link-controls.tsx`, disabled the `isProgramLink` check and removed the tooltip that blocked deletion
   - In `links-toolbar.tsx`, removed the condition that disabled the Delete button for links with programs
7. Enhanced the API and UI to handle links with commissions properly:
   - Added a `_count.commissions` field to the link query to check if a link has commissions
   - Added a `hasCommissions` flag to each link in the response
   - Updated the link controls to disable the delete button for links with commissions
   - Added clear tooltips explaining why links with commissions cannot be deleted
   - Added server-side validation to prevent deletion of links with commissions
   - Fixed error handling in the delete modal to show clear error messages
8. Fixed TypeScript linter errors by adding type assertions for the `hasCommissions` property
9. Fixed the Program-Reward relationship constraint issue:
   - Modified the deletion process to update programs and set `defaultRewardId` and `defaultDiscountId` to null before deletion
   - This ensures the program can be deleted without violating database constraints
   
The changes now allow users to delete links that are associated with programs, with those programs being deleted as well. At the same time, we prevent the deletion of links that have commissions, with clear UI indicators and tooltips explaining the restriction. Database integrity is maintained by properly handling all relationships between models.

## Executor's Feedback or Assistance Requests
All implementation tasks are complete. The next step is to test the functionality to ensure it works as expected. We should test:
1. Deleting links without programs (should work as before)
2. Deleting links with programs (should delete both the link and the program)
3. Verify the UI properly informs users when they are deleting links with programs
4. Verify that links with commissions cannot be selected for deletion and show proper tooltips
5. Verify that programs with rewards can be deleted without errors

## Lessons
- Read the file before you try to edit it.
- Include info useful for debugging in the program output.
- UI validations need to be updated in sync with backend changes to ensure consistent behavior.
- Database relationships and constraints need to be carefully considered when implementing deletion operations.
- Preserve financial records by preventing deletion of links with commissions rather than cascading deletion.
- Provide clear UI feedback before users attempt actions that will fail, rather than showing error messages afterward.
- Handle all related database relationships correctly to avoid constraint violations during deletion operations.
