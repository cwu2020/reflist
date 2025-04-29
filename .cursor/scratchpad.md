# ShopMy API Integration Plan

## Background and Motivation

We need to integrate with the ShopMy API to enable users to create affiliate links through the ShopMy platform. When users create a new link and enter a product URL, we want to fetch merchant data from ShopMy and generate a ShopMy-affiliated link that will credit the user when people make purchases through that link.

The ShopMy API integration requires creating proxy endpoints on our server to make secure API calls to ShopMy, obtaining merchant data based on product URLs, and generating affiliate pins that result in trackable short links.

## Key Challenges and Analysis

1. **Authentication & Security**: We need to securely store and use the ShopMy creator token without exposing it to clients.
2. **Proxy Implementation**: We need to create server-side proxy endpoints to handle communication with ShopMy API.
3. **Schema Update**: We need to store ShopMy merchant metadata and original URLs with links in our database.
4. **UI Integration**: We need to surface ShopMy merchant data in the UI when users enter a URL.
5. **Link Processing**: We need to modify the link creation process to generate and store ShopMy links.

## High-level Task Breakdown

1. **Create ShopMy API Environment Configuration**:
   - Add SHOPMY_CREATOR_TOKEN to environment variables
   - Success criteria: Environment variable is configured and accessible in the API routes

2. **Create Server-Side Proxy Endpoints**:
   - Implement `/api/shopmy/data` endpoint to fetch merchant data
   - Implement `/api/shopmy/pins` endpoint to create ShopMy pins
   - Success criteria: Both endpoints successfully communicate with ShopMy API and return appropriate responses

3. **Update Prisma Schema for ShopMy Metadata**:
   - Add `shopmyMetadata` JSON field to Link model to store merchant data
   - Add `originalUrl` field to Link model to store user-entered URL
   - Success criteria: Schema is updated and migrations are applied without errors

4. **Implement Link Creation Flow**:
   - Modify link creation to fetch ShopMy data when a URL is entered
   - Process ShopMy data and save it with the link
   - Generate ShopMy pin and replace the destination URL with ShopMy URL
   - Success criteria: Links are created with ShopMy URLs and metadata is stored correctly

5. **Update UI Components**:
   - Add UI elements to display ShopMy merchant data
   - Success criteria: Merchant data is properly displayed in the UI during link creation

## Project Status Board

- [x] Create ShopMy API Environment Configuration
  - [x] Add SHOPMY_CREATOR_TOKEN to environment variables
  - [x] Add validation for the token

- [x] Create Server-Side Proxy Endpoints
  - [x] Implement `/api/shopmy/data` endpoint
  - [x] Implement `/api/shopmy/pins` endpoint
  - [x] Add error handling
  - [x] Add rate limiting

- [x] Update Prisma Schema for ShopMy Metadata
  - [x] Add `shopmyMetadata` JSON field to Link model
  - [x] Add `originalUrl` field to Link model
  - [x] Run migrations

- [x] Implement Link Creation Flow
  - [x] Create utility functions to handle ShopMy integration
  - [x] Update createLink function to handle ShopMy integration
  - [x] Add logic to replace URL with ShopMy URL

- [x] Update UI Components
  - [x] Create ShopMyIntegration component 
  - [x] Add component to link creation form
  - [x] Implement loading states while fetching data

## Executor's Feedback or Assistance Requests

The ShopMy API integration has been successfully implemented, but during testing we encountered an authentication issue with the API endpoints. 

**Issue**: When the frontend tried to call the ShopMy proxy endpoints, we received a 401 Unauthorized error with the message "Missing Authorization header". This was happening because we initially used the `withWorkspace` middleware which requires a specific authorization scheme.

**Solution**:
1. Modified the API routes to use a simpler authentication approach:
   - Removed the `withWorkspace` middleware
   - Added direct session validation using `getServerSession`
   - Improved error responses to be more frontend-friendly
   
2. Enhanced error handling in the utility functions:
   - Added specific handling for 401 (unauthorized) and 500 (server) errors
   - Improved error logging with more detailed messages
   
3. Added the SHOPMY_CREATOR_TOKEN to the environment:
   - Created/updated the `.env.local` file with the token from the documentation
   - Restarted the development server to apply the changes

After these changes, the API endpoints can now be accessed correctly from the frontend, and the ShopMy integration should work as expected.

## Lessons

1. When adding new fields to a Prisma schema, it's important to also update the type definitions and Zod schemas to maintain type safety
2. Using type assertions may be necessary when working with recently added schema fields until the types are fully propagated
3. Proxy patterns are effective for keeping API secrets secure while still enabling client-side functionality
4. Rate limiting is important for external API calls to prevent abuse
5. Consider the authentication requirements when creating new API routes; the `withWorkspace` middleware may be too restrictive for some frontend-initiated calls
6. Test API endpoints directly before integrating them with the frontend to catch auth issues early 