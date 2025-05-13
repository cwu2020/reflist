# Shop Tab Implementation Plan

## Background and Motivation
The Shop tab will provide users with a streamlined interface to create shopping links with cashback functionality. We want to consolidate the multi-page flow into a single scrollable form for better user experience and reduced navigation friction.

## Key Challenges and Analysis
1. UI Consistency
   - Need to maintain visual consistency with existing dashboard tabs
   - Must adapt onboarding step UI for dashboard context
   - Ensure smooth transitions and animations between steps

2. URL Processing
   - Integration with ShopMy merchant data fetch
   - URL validation and transformation
   - Handling various product URL formats

3. Commission Splits
   - Managing commission split settings
   - Handling different user roles (self vs friend)
   - Calculating and displaying commission rates

4. iMessage Integration
   - Pre-drafted message templates
   - Phone number handling
   - Link formatting for iMessage

5. Single Page Flow
   - Managing state across multiple steps
   - Smooth transitions between steps
   - Proper blur/unblur effects for next steps
   - Maintaining form data across steps

## High-level Task Breakdown

### Phase 1: Consolidate Form Structure
- [ ] Create new unified shop form component
  - Success Criteria: Single form component that contains all steps
  - Dependencies: None
- [ ] Implement step state management
  - Success Criteria: Steps can be tracked and transitioned between
  - Dependencies: None
- [ ] Add scroll behavior
  - Success Criteria: Smooth scrolling between steps
  - Dependencies: None

### Phase 2: Step Implementation
- [ ] Implement URL input step
  - Success Criteria: Product URL input with preview
  - Dependencies: ShopMy integration
- [ ] Implement buyer selection step
  - Success Criteria: Me/Friend selection with proper UI
  - Dependencies: None
- [ ] Implement commission split step (for friend path)
  - Success Criteria: Commission split settings with validation
  - Dependencies: None
- [ ] Implement iMessage step (for friend path)
  - Success Criteria: Message template with link preview
  - Dependencies: None
- [ ] Implement final step (for me path)
  - Success Criteria: Link preview with actions
  - Dependencies: None

### Phase 3: Polish and Integration
- [ ] Add loading states
  - Success Criteria: Loading indicators for all async operations
  - Dependencies: None
- [ ] Implement error handling
  - Success Criteria: User-friendly error messages
  - Dependencies: None
- [ ] Add analytics tracking
  - Success Criteria: Events tracked for key user actions
  - Dependencies: None

## Project Status Board
- [ ] Create new unified shop form component
- [ ] Implement step state management
- [ ] Add scroll behavior
- [ ] Implement URL input step
- [ ] Implement buyer selection step
- [ ] Implement commission split step
- [ ] Implement iMessage step
- [ ] Implement final step
- [ ] Add loading states
- [ ] Implement error handling
- [ ] Add analytics tracking

## Executor's Feedback or Assistance Requests
- Ready to start implementing the unified form approach
- Need to decide on the exact step transition animations and blur effects
- Will need to carefully manage form state across steps

## Lessons
- When reusing components from other parts of the application, it's better to create a local version to avoid import path issues
- The StepPage component should be customized for the shop section to maintain consistency while allowing for specific requirements
- When implementing forms, it's important to handle loading states for both the preview image and external API calls
- The ShopMy API integration needs to be implemented to fetch merchant data and cashback rates
- Using localStorage for state management between steps is a good approach for maintaining data across page transitions
- For single-page flows, we should use React state instead of localStorage for better performance and user experience
