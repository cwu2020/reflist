# Phone Verification System

This directory contains the implementation of the phone verification system used for verifying phone numbers and claiming commissions. The system is designed to work with both Twilio and a fallback database-backed implementation.

## Components

### Phone Verification API

1. **Send Verification Code**: `POST /api/phone-verification/send`
   - Sends a verification code to a phone number
   - Rate limited to prevent abuse
   - Returns success/error response

2. **Verify Code**: `POST /api/phone-verification/verify`
   - Verifies a code sent to a phone number
   - Checks for unclaimed commissions associated with the phone number
   - Returns verification status and commission data if successful

### Database Models

The system uses a `PhoneVerificationToken` model to store verification tokens:

```prisma
model PhoneVerificationToken {
  id         String   @id @default(cuid())
  identifier String   // Phone number in E.164 format
  token      String   // Hashed verification code
  expires    DateTime // Expiration timestamp
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([identifier, token])
  @@index([identifier])
}
```

### Implementation Details

- **Twilio Integration**: Uses Twilio Verify API for reliable SMS delivery
- **Fallback Option**: Includes a database-backed implementation for development/testing
- **Security Features**:
  - Rate limiting to prevent abuse
  - Token hashing for secure storage
  - Short expiration times
  - Cleanup of used tokens

## Configuration

Add the following variables to your `.env` file:

```env
# Twilio Configuration for Phone Verification
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
USE_TWILIO_VERIFICATION=true # Set to true to use Twilio, false to use database fallback
```

## Usage

### API Usage

```javascript
// Send verification code
const sendResponse = await fetch("/api/phone-verification/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phoneNumber: "+1234567890" }),
});

// Verify code
const verifyResponse = await fetch("/api/phone-verification/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    phoneNumber: "+1234567890",
    code: "123456"
  }),
});
```

### UI Components

The system includes a ready-to-use `PhoneVerificationForm` component that handles the verification flow:

```jsx
import PhoneVerificationForm from "@/ui/verification/phone-verification-form";

function MyPage() {
  const handleVerificationSuccess = (phoneNumber, unclaimedCommissions) => {
    // Handle successful verification
    console.log(`Phone verified: ${phoneNumber}`);
    console.log(`Unclaimed commissions: ${unclaimedCommissions.length}`);
  };

  return (
    <PhoneVerificationForm onVerificationSuccess={handleVerificationSuccess} />
  );
}
```

## Development and Testing

For local development without Twilio:

1. Set `USE_TWILIO_VERIFICATION=false` in your .env file
2. The system will use the database-backed implementation
3. Verification codes will be logged to the console 