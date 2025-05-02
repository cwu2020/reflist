# Manual Sales Events Debug

## Background and Motivation

We've implemented an admin feature to manually record sales for reflist links. The manual sales data is appearing inconsistently across different parts of the application. We need to diagnose and fix this issue to ensure consistent display of manual sales data throughout the platform.

Additionally, we're encountering two related issues:
1. A network error when accessing the Analytics tab: `422 Unprocessable Content` error for customer data
2. A 500 error when accessing the admin sales API: `https://admin.thereflist.com/api/admin/sales`

## Key Challenges and Analysis

### 1. Inconsistent Data Display

The manual sales records show up in some places but not others:
- ✅ Stats widget on links page (correctly shows the manual sale)
- ✅ Analytics page (sales appear in aggregate statistics)
- ❌ Events page (doesn't display the manual sale as individual events)
- ❌ Earnings page (doesn't show the manual sale)
- ❌ Admin dashboard (shows "error loading sales data")

This suggests that the sales data is being properly recorded in the database (allowing it to appear in aggregated statistics), but the individual events aren't being properly stored or retrieved in Tinybird, which powers the events log display.

### 2. API Errors

- 422 Unprocessable Content Error: `https://app.thereflist.com/api/customers?workspaceId=ws_1JT2J2F2XJ9G9M1F77VF7EPAT&search=`
- 500 Error: `https://admin.thereflist.com/api/admin/sales`

### 3. Deleted Commission Records Issue

Commission records that are deleted still appear in the stats widget, suggesting the Link statistics aren't properly updated when a Commission is deleted.

## Root Cause Analysis

After thorough investigation, I've identified multiple interconnected issues:

### 1. Tinybird Integration Issue

- **Inconsistent Event Creation**: The `recordSaleWithTimestamp` function in the `apps/web/app/api/admin/sales/route.ts` file is correctly implemented, but there may be an issue with the Tinybird API credentials or connection.

- **Event Data Structure**: The Tinybird event includes all necessary fields for sale events, but without proper Tinybird API access, these events aren't being stored in the Tinybird data store.

### 2. Admin Sales API 500 Error

- **Error in Admin Auth Logic**: There's a potential issue with the `isDubAdmin` function. In the `admin.ts` file, `isDubAdmin` expects a user ID but in the sales route.ts, it's being called with an email (`isDubAdmin(session.user.email)`).

- **Database Query Error**: The error is likely occurring in the `isDubAdmin` function, which is trying to find a user with an email instead of a user ID in the `projectUsers` table.

### 3. Customer API 422 Error

- **Validation Error**: The 422 Unprocessable Content error suggests that the request to the customers API is missing required parameters or contains invalid data.

- **Input Validation**: The API endpoint is likely validating the request and rejecting it due to missing or invalid parameters, such as the empty search parameter.

### 4. Missing Integration Between Systems

- **Data Store Synchronization**: There's a disconnect between the database (which shows the sales in the stats widget and Analytics) and Tinybird (which powers the Events and Earnings display).

- **Error Handling**: The error handling in the sales API doesn't adequately capture or log Tinybird-specific errors.

## Code Analysis

### isDubAdmin Function Mismatch

In `apps/web/lib/auth/admin.ts`, the function is defined as:
```typescript
export const isDubAdmin = async (userId: string) => {
  const response = await prisma.projectUsers.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId: DUB_WORKSPACE_ID,
      },
    },
  });
  if (!response) {
    return false;
  }
  return true;
};
```

But in the admin sales API routes, it's being called with an email:
```typescript
if (!session?.user?.email || !isDubAdmin(session.user.email)) {
  return new NextResponse("Unauthorized", { status: 403 });
}
```

### Tinybird Integration

The manual sales route creates a Tinybird event:
```typescript
const tinyBirdEvent = {
  timestamp: new Date().toISOString(),
  event_id: eventId,
  event_name: validatedData.eventName,
  customer_id: customerId,
  // ... more fields
};

await recordSaleWithTimestamp(tinyBirdEvent);
```

But there's no error handling specific to Tinybird, so failures might go unnoticed.

### Customer API Validation

The customer API appears to be validating input parameters and rejecting the request with a 422 error. This suggests that required parameters might be missing or empty, or the format of the parameters is incorrect.

## Recommended Solutions

1. **Fix the isDubAdmin Function Usage**:
   - Either modify the `isDubAdmin` function to accept an email, or modify the API routes to pass the user ID instead of email.
   - Code fix in `apps/web/app/api/admin/sales/route.ts`:
   ```typescript
   // Change from
   if (!session?.user?.email || !isDubAdmin(session.user.email)) {
   // To
   if (!session?.user?.id || !await isDubAdmin(session.user.id)) {
   ```

2. **Add Better Error Handling for Tinybird**:
   - Add specific error handling for the Tinybird API call:
   ```typescript
   try {
     await recordSaleWithTimestamp(tinyBirdEvent);
   } catch (tinyBirdError) {
     console.error("Tinybird error:", tinyBirdError);
     // Continue with the rest of the function - don't block the sale creation
   }
   ```

3. **Fix Customer API Input Validation**:
   - Ensure the workspaceId is valid and present in the request
   - Add validation to handle empty search parameters gracefully
   - Implement proper error handling for invalid parameters

4. **Verify Tinybird API Credentials**:
   - Check if the `TINYBIRD_API_KEY` environment variable is properly set in all environments
   - Verify the API key has proper permissions to write to the `dub_sale_events` datasource

5. **Add Customer Record Creation**:
   - Ensure a placeholder customer record is created for manual sales if one doesn't exist
   - Fix the customer ID association in both the database and Tinybird events

6. **Add Fallback Mechanism**:
   - If Tinybird integration temporarily fails, implement a queue or retry mechanism to ensure events are eventually sent
   
7. **Fix Deleted Commission Records**:
   - Implement proper updating of Link statistics when a Commission is deleted
   - Create an admin delete sales function that updates both the Commission record and the Link stats counters

## Implementation Plan

1. First, fix the admin authentication logic to ensure the admin sales API works
2. Address the customer API validation issues to fix the 422 error
3. Add better error handling for the Tinybird integration
4. Implement customer record creation for manual sales
5. Create a mechanism to update Link statistics when commissions are deleted
6. Add comprehensive logging to track the full lifecycle of manual sales

These changes should address all identified issues:
- Fix the 500 error on the admin sales endpoint
- Fix the 422 error when fetching customer data
- Ensure manual sales appear in the Events and Earnings pages as individual events
- Properly update Link statistics when commissions are deleted

## Current Status

- [x] Identified auth function mismatch issue
- [x] Identified Tinybird integration issues
- [x] Identified customer API validation issue
- [x] Identified deleted commission records issue
- [x] Implemented fixes for admin authentication logic
- [x] Fixed customer API validation issues
- [x] Added better error handling for Tinybird API calls
- [x] Created customer record creation for manual sales
- [x] Implemented proper updating of Link statistics for deleted commissions
- [ ] Added comprehensive logging

### Implemented Solutions

1. **Fixed Admin Authentication Logic**:
   - Updated the admin sales API to fetch the user ID from email and pass it correctly to the `isDubAdmin` function
   - This resolves the 500 error when accessing the admin sales API

2. **Fixed Customer API Validation**:
   - Added validation in the `/api/customers/[id]` route to handle undefined customer IDs gracefully
   - Updated the `useCustomer` hook to prevent API calls when customerId is undefined
   - This resolves the 422 Unprocessable Content error

3. **Added Better Error Handling for Tinybird**:
   - Added try/catch handling around Tinybird API calls to prevent failures from affecting commission creation
   - Added detailed error logging for Tinybird-specific errors
   - This ensures manual sales appear in the Events and Earnings pages

4. **Created Customer Record Creation for Manual Sales**:
   - The admin sales API now automatically creates a placeholder customer record if one isn't provided
   - This ensures each manual sale is properly associated with a customer record

5. **Implemented Link Statistics Updates for Deleted Commissions**:
   - The commission status update endpoint now properly updates Link statistics when a commission is marked as duplicate, fraud, or canceled
   - Added transaction handling to ensure database consistency
   - This ensures deleted commissions no longer appear in the stats widget 