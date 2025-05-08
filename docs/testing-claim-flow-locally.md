# Testing Commission Claim Flow Locally

This guide explains how to properly test the commission claim flow in your local development environment.

## Setup

1. Make sure your local server is running:
   ```
   npm run dev
   ```

2. Access the claim page at:
   ```
   http://localhost:8888/claim
   ```

## What was fixed

Previously, visiting `localhost:8888/claim` would redirect to `localhost:8888/claim/links` which was a non-existent route. 

We've modified the middleware (`apps/web/middleware.ts`) to:
1. Detect when the domain is `localhost:8888`
2. Rewrite `/claim` to `/app.thereflist.com/claim` instead of redirecting to an external domain

## Testing the full claim flow

To properly test the full claim flow, follow these steps:

1. **Verify a phone number**:
   - Enter a phone number that has unclaimed commissions in your database
   - Complete the verification code process

2. **See unclaimed commissions**:
   - After verification, you should see a list of unclaimed commissions
   - The data will be stored in localStorage with a 1-hour expiry

3. **Test the auto-claim after login flow**:
   - If you're not logged in, click "Sign In" to go to the login page
   - After logging in, you should be redirected back to the claim page
   - The system will attempt to auto-claim your commissions using the special "AUTO_CLAIM_AFTER_LOGIN" code

4. **Test the create account flow**:
   - Alternatively, click "Create an Account to Claim" to test the new user registration flow
   - The phone number should be pre-filled on the registration form

## Handling edge cases

To properly test edge cases, try these scenarios:

1. **Expired verification data**:
   - Verify a phone number but wait for more than 1 hour (or manually modify the expiry in localStorage)
   - Refresh the page to see the "Your previous verification has expired" message

2. **Network issues during auto-claim**:
   - Simulate offline mode in your browser's dev tools during the auto-claim process
   - Verify that the verification data is retained in localStorage for retry

3. **Multiple phone verifications**:
   - Verify one phone number, then verify another in a different tab
   - Each verification should be stored separately with phone-specific localStorage keys

## Troubleshooting

If you encounter issues:

1. **Check localStorage**:
   - Open browser dev tools and inspect localStorage for keys starting with `reflist_phone_verification_data`
   - Verify the data structure and expiration time

2. **Check console logs**:
   - The claim flow includes detailed logging to help with debugging
   - Look for messages about verification status, claim attempts, and errors

3. **API responses**:
   - Monitor network requests in your browser's dev tools
   - Pay attention to the `/api/phone-verification/verify` endpoint responses

Remember that changes to the middleware require a server restart to take effect. 