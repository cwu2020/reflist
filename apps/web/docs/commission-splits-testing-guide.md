# Commission Splits Testing Guide

This guide outlines the steps to thoroughly test the commission splitting feature from end to end.

## Prerequisites

1. A Reflist account to create links with commission splits
2. A working phone number for verification
3. A local development environment with the necessary environment variables
   - For Twilio testing: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `USE_TWILIO_VERIFICATION=true`
   - For development testing without Twilio: `USE_TWILIO_VERIFICATION=false`

## Testing Process

### 1. Creating Links with Commission Splits

1. **Log in** to your Reflist account.
2. **Navigate** to the link creation page.
3. **Configure** a new link with the basic details (URL, domain, etc.).
4. **Enable** the "Commission Splits" option in the link builder.
5. **Add** a phone number to split commissions with.
6. **Set** the split percentage using the slider (e.g., 30%).
7. **Verify** the remaining percentage shows for the creator (e.g., 70%).
8. **Save** the link.

**Success Criteria:**
- Link is created successfully
- Link details show the commission split configuration
- `commissionSplits` field in the Link model contains the expected data

### 2. Recording a Sale with Commission Splits

1. **Log in** as an administrator.
2. **Navigate** to the sales recording interface.
3. **Select** the link you created with commission splits.
4. **Record** a sale with a specific amount (e.g., $100).
5. **Submit** the sale.

**Success Criteria:**
- Sale is recorded successfully
- Original partner (link creator) receives their portion of the commission (e.g., 70% of the earnings)
- Commission record includes split information
- Split recipient is recorded with phoneNumber and unclaimed status

### 3. Testing the Phone Verification Process

1. **Open** an incognito browser window (to simulate an unauthenticated user).
2. **Navigate** to `/claim` in your application.
3. **Enter** the phone number you used when creating the commission split.
4. **Request** a verification code.
5. **If using Twilio**: Receive SMS and enter the code.
   **If using the development fallback**: Check the server logs for the generated code and enter it.
6. **Verify** the phone number.

**Success Criteria:**
- Verification code is sent successfully
- Verification process completes successfully
- After verification, unclaimed commissions are displayed with correct amounts
- The UI shows total earnings and individual commission details

### 4. Testing the Earnings Claim Process

1. **Click** the "Create an Account to Claim" button on the verification success page.
2. **Verify** you're redirected to the registration page with phoneNumber and claim parameters in the URL.
3. **Complete** the registration form with email and password.
4. **Verify** your email by entering the verification code.
5. **Complete** the registration process.

**Success Criteria:**
- Registration process completes successfully
- User is redirected to dashboard
- Unclaimed commissions are now claimed and assigned to the new user
- Commission records are updated to reflect claimed status
- User can see the earnings in their dashboard

### 5. Testing Edge Cases

1. **Verification with no commissions**:
   - Verify a phone number with no associated commissions
   - Confirm the UI correctly shows no commissions found

2. **Multiple splits to the same phone number**:
   - Create multiple links with the same phone number for splits
   - Record sales for these links
   - Verify the phone number and confirm all commissions are displayed
   - Claim the commissions and verify all are claimed properly

3. **Invalid phone number format**:
   - Attempt to verify an invalid phone number format
   - Confirm appropriate validation errors are shown

4. **Expired verification code**:
   - Request a verification code but wait for it to expire (10 minutes)
   - Attempt to verify with the expired code
   - Confirm appropriate error message is shown

5. **Already claimed commissions**:
   - Attempt to claim commissions that have already been claimed
   - Confirm appropriate notification is shown

## Debugging Tips

1. **Check server logs** for verification code generation in development mode.
2. **Monitor database** records for commissions, commission splits, and verification tokens.
3. **Use browser developer tools** to inspect network requests and responses.
4. **Verify environment variables** are correctly set for Twilio integration.

## Common Issues and Solutions

1. **Verification code not sent**:
   - Check Twilio credentials
   - Ensure phone number is in correct international format
   - Check rate limiting hasn't been triggered

2. **Commissions not showing after verification**:
   - Verify the phone number matches exactly what was used when creating the split
   - Check database to ensure commissions exist with the correct phone number

3. **Claim process not working**:
   - Verify URL parameters are correctly passed between verification and registration
   - Check if the claiming logic in createUserAccountAction is being triggered
   - Inspect transaction logs for any errors during the claiming process

4. **Phone number format issues**:
   - Ensure phone numbers are stored in E.164 format (+countrycode followed by number)
   - Check for any discrepancies in formatting between storage and verification

## Full Flow Testing Checklist

- [ ] Creating links with commission splits works
- [ ] Recording sales for split links works
- [ ] Phone verification API functions correctly
- [ ] ClaimPage UI displays correctly
- [ ] Registration with phone verification works
- [ ] Commission claiming during registration works
- [ ] Edge cases are handled gracefully
- [ ] User experience is smooth and intuitive

This guide should help ensure the commission splits feature works correctly from end to end. Make sure to test each step thoroughly before moving to production. 