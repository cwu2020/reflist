# Phone Verification & Commission Claiming Process

This document outlines the complete flow for phone verification and commission claiming in RefList, covering all scenarios and edge cases with code references.

## 1. Overview and Core Concepts

### 1.1 Key Entities

- **Commission Split**: Records how earnings should be distributed to partners
- **Partner**: Entity that earns commissions (may or may not be associated with a user)
- **User**: Authenticated person who can own one or more partner accounts
- **PartnerUser**: Many-to-many relationship between partners and users

### 1.2 Database Schema

```
Commission <---> CommissionSplit <---> Partner <---> User
                    |                    ^ 
                    v                    |
                PhoneNumber              |
                    |                    |
                    +--------------------+
```

### 1.3 Key Flows

1. **New User Claiming Flow**: A new user verifies their phone number, sees unclaimed commissions, and creates an account
2. **Existing User Claiming Flow**: A user with an existing account verifies their phone to claim commissions
3. **Post-Login Claiming Flow**: A user verifies their phone while not logged in, then logs in to claim commissions
4. **Auto-Claiming Flow**: When creating a commission with a phone number already associated with a user

## 2. Phone Verification Process

### 2.1 User Initiates Verification

Users start the verification process by visiting the claim page:

```tsx
// apps/web/app/app.thereflist.com/claim/page-client.tsx
<div className="bg-white p-6 rounded-lg shadow-md">
  <div className="mb-6">
    <h2 className="text-xl font-bold">Verify Your Phone Number</h2>
    <p className="text-gray-500 text-sm mt-1">
      Enter your phone number to check if you have any unclaimed commissions.
    </p>
    {verificationExpired && (
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
        Your previous verification has expired. Please verify your phone number again.
      </div>
    )}
  </div>
  <PhoneVerificationForm onVerificationSuccess={handleVerificationSuccess} />
</div>
```

### 2.2 Sending Verification Code

When a user enters their phone number, a verification code is sent:

```tsx
// apps/web/ui/verification/phone-verification-form.tsx
const handleSendCode = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSending(true);

  try {
    const response = await fetch("/api/phone-verification/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (response.ok) {
      toast.success(data.message || "Verification code sent!");
      setCodeSent(true);
    } else {
      toast.error(data.error || "Failed to send verification code");
    }
  } catch (error) {
    toast.error("An error occurred while sending the verification code");
  } finally {
    setIsSending(false);
  }
};
```

### 2.3 Verifying Code and Checking Commissions

When the user submits the verification code:

```tsx
// apps/web/ui/verification/phone-verification-form.tsx
const handleVerifyCode = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsVerifying(true);

  try {
    const response = await fetch("/api/phone-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code: verificationCode }),
    });

    const data = await response.json();

    if (response.ok) {
      toast.success(data.message || "Phone number verified successfully");
      // Check if already claimed and pass data to parent
      const alreadyClaimed = data.data?.alreadyClaimed === true;
      onVerificationSuccess(
        phoneNumber, 
        data.data?.unclaimedCommissions || [], 
        alreadyClaimed
      );
    } else {
      toast.error(data.error || "Failed to verify phone number");
    }
  } catch (error) {
    toast.error("An error occurred during verification");
  } finally {
    setIsVerifying(false);
  }
};
```

### 2.4 Server-Side Verification

The API endpoint validates the verification code:

```typescript
// apps/web/app/api/phone-verification/verify/route.ts
export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(10, ip);
    
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and verification code are required" },
        { status: 400 }
      );
    }

    // Check if this is a post-login auto-claim request
    const isAutoClaimAfterLogin = code === "AUTO_CLAIM_AFTER_LOGIN";
    
    // Verify the code or handle auto-claim case
    let verificationResult = { success: true, message: "Auto-claim after login" };
    
    if (!isAutoClaimAfterLogin) {
      verificationResult = await verifyPhoneNumber(phoneNumber, code);
      if (!verificationResult.success) {
        return NextResponse.json({ error: verificationResult.message }, { status: 400 });
      }
    } else {
      // For auto-claim, ensure user is logged in
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: "Authentication required for auto-claiming" },
          { status: 401 }
        );
      }
    }
    
    // Continue with commission checking and claiming...
  } catch (error) {
    // Error handling...
  }
}
```

## 3. Commission Claiming Scenarios

### 3.1 Scenario: Logged-in User Claims Commissions (Direct Flow)

When a user is already logged in and verifies their phone:

```typescript
// apps/web/app/api/phone-verification/verify/route.ts
// Check if the user is logged in
const session = await getServerSession(authOptions);
const user = session?.user as { id?: string; defaultPartnerId?: string } | undefined;
let userId = user?.id;
let userDefaultPartnerId = user?.defaultPartnerId;
let userLoggedIn = !!userId;
let claimedAny = false;

// If user is logged in, handle commission claiming
if (userLoggedIn && userId) {
  await prisma.$transaction(async (tx) => {
    // Find unclaimed commission splits for this phone
    const commissionSplits = await tx.$queryRaw`
      SELECT s.*, c.* FROM "CommissionSplit" s
      LEFT JOIN "Commission" c ON s."commissionId" = c.id
      WHERE s."phoneNumber" = ${phoneNumber} AND s.claimed = false
    `;
    
    const splits = Array.isArray(commissionSplits) ? commissionSplits : [];

    if (splits.length > 0) {
      claimedAny = true;
      
      // Check if phone is already associated with a partner
      const existingPartnerWithPhone = await tx.$queryRaw`
        SELECT * FROM "Partner" WHERE "phoneNumber" = ${phoneNumber} LIMIT 1
      `;
      
      // Determine which partner ID to use for claiming
      let partnerIdForClaiming = userDefaultPartnerId;
      
      if (existingPartnerWithPhone && Array.isArray(existingPartnerWithPhone) && existingPartnerWithPhone.length > 0) {
        const partnerWithPhone = existingPartnerWithPhone[0];
        
        // Associate this partner with the user if not already
        const existingAssociation = await tx.partnerUser.findUnique({
          where: {
            userId_partnerId: {
              userId: userId,
              partnerId: partnerWithPhone.id
            }
          }
        });
        
        if (!existingAssociation) {
          // Create association between user and partner
          await tx.partnerUser.create({
            data: {
              userId: userId,
              partnerId: partnerWithPhone.id,
              role: 'owner'
            }
          });
        }
        
        // If user doesn't have a default partner ID yet, set this as default
        if (!userDefaultPartnerId) {
          await tx.user.update({
            where: { id: userId },
            data: { defaultPartnerId: partnerWithPhone.id }
          });
          
          userDefaultPartnerId = partnerWithPhone.id;
        }
        
        // Use the found partner for claiming
        partnerIdForClaiming = partnerWithPhone.id;
      } else if (userDefaultPartnerId) {
        // Update user's default partner with phone number
        await tx.$executeRaw`
          UPDATE "Partner" SET "phoneNumber" = ${phoneNumber} 
          WHERE id = ${userDefaultPartnerId}
        `;
      }
      
      // Mark commission splits as claimed by this partner
      if (partnerIdForClaiming) {
        for (const split of splits) {
          await tx.$executeRaw`
            UPDATE "CommissionSplit" 
            SET claimed = true, 
                "claimedAt" = NOW(), 
                "claimedById" = ${partnerIdForClaiming},
                "partnerId" = ${partnerIdForClaiming}
            WHERE id = ${split.id}
          `;
        }
      }
    }
  });
  
  // Return success response for logged-in user
  if (claimedAny) {
    return NextResponse.json({
      success: true,
      message: "Phone number verified and commissions claimed successfully",
      data: {
        verified: true,
        hasUnclaimedCommissions: false,
        unclaimedCommissions: [],
        alreadyClaimed: true
      },
    });
  }
}
```

### 3.2 Scenario: Non-Logged-in User Verifies Phone

When a user without a login verifies phone and sees unclaimed commissions:

```typescript
// apps/web/app/api/phone-verification/verify/route.ts
// For non-logged in users, get unclaimed commissions
let unclaimedCommissions: CommissionData[] = [];
try {
  const splitsQuery = await prisma.$queryRaw`
    SELECT s.*, s."createdAt" as date, s.earnings
    FROM "CommissionSplit" s
    WHERE s."phoneNumber" = ${phoneNumber} AND s.claimed = false
  `;
  
  const splits = Array.isArray(splitsQuery) ? splitsQuery : [];
  
  // Process unclaimed commission data
  unclaimedCommissions = splits.map(split => ({
    id: split.id,
    amount: 0, 
    currency: "USD",
    earnings: split.earnings,
    linkTitle: "Commission", 
    date: split.date || split.createdAt,
  }));

  // Enhance with more detailed commission data
  for (let i = 0; i < unclaimedCommissions.length; i++) {
    // Fetch additional details...
  }
} catch (error) {
  console.error("Error fetching commission splits:", error);
  unclaimedCommissions = [];
}

// Return unclaimed commissions to the user
return NextResponse.json({
  success: true,
  message: verificationResult.message,
  data: {
    verified: true,
    hasUnclaimedCommissions: unclaimedCommissions.length > 0,
    unclaimedCommissions,
    userLoggedIn
  },
});
```

### 3.3 Scenario: New User Creates Account to Claim (Register Flow)

When a user verifies their phone and decides to create a new account:

```tsx
// apps/web/app/app.thereflist.com/claim/page-client.tsx
const handleSignUp = () => {
  // Navigate to sign up page with phone number pre-filled
  router.push(`/register?phoneNumber=${encodeURIComponent(verifiedPhone)}&claim=true`);
};

// In the UI:
<Button onClick={handleSignUp} className="w-full">
  Create an Account to Claim
</Button>
```

The registration process then includes claiming:

```typescript
// apps/web/lib/actions/create-user-account.ts
export const createUserAccountAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    const { email, password, code, phoneNumber, claim } = parsedInput;
    
    // User creation logic...
    
    if (!user) {
      // Create user and corresponding partner record
      const userId = createId({ prefix: "user_" });
      
      await prisma.$transaction(async (tx) => {
        // Create user
        const newUser = await tx.user.create({
          data: {
            id: userId,
            email,
            passwordHash: await hashPassword(password),
            emailVerified: new Date(),
          },
        });
        
        // Create partner record
        const partnerId = createId({ prefix: "pn_" });
        const partner = await tx.partner.create({
          data: {
            id: partnerId,
            name: email.split('@')[0],
            email,
            users: {
              create: {
                userId: newUser.id,
                role: 'owner',
              },
            },
            ...(phoneNumber && { phoneNumber: phoneNumber }),
          },
        });
        
        // Update user with defaultPartnerId
        await tx.user.update({
          where: { id: newUser.id },
          data: { defaultPartnerId: partner.id },
        });

        // If user is claiming commissions, process unclaimed commissions
        if (claim && phoneNumber) {
          await claimUnclaimedCommissions(tx, phoneNumber, partnerId);
        }
      });
    }
  });
```

### 3.4 Scenario: Post-Login Claiming Flow

When a user verifies phone while not logged in, then signs in:

```tsx
// apps/web/app/app.thereflist.com/claim/page-client.tsx
// Save verification data to localStorage for post-login retrieval
if (!alreadyClaimed && commissions.length > 0) {
  // Set expiry time for the verification data
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS).toISOString();
  
  // Save with phone number as part of the key for multiple verifications
  const storageKey = `${VERIFICATION_STORAGE_KEY}_${phoneNumber.replace(/\D/g, '')}`;
  
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      verified: true,
      verifiedPhone: phoneNumber,
      unclaimedCommissions: commissions,
      expiresAt
    })
  );
}

// Handle sign in navigation
const handleSignIn = () => {
  // Navigate to sign in page with return URL
  router.push(`/signin?next=${encodeURIComponent('/claim')}`);
};

// After login, detect session and trigger auto-claim
useEffect(() => {
  // Only run if user is logged in, verification happened, and commissions aren't claimed
  if (status === "authenticated" && verified && !alreadyClaimed && 
      session?.user && unclaimedCommissions.length > 0) {
    claimAfterLogin();
  }
}, [status, verified, alreadyClaimed, session, unclaimedCommissions]);

// Auto-claim after login
const claimAfterLogin = async () => {
  setIsProcessing(true);
  
  try {
    // Call verification endpoint with special auto-claim code
    const response = await fetch("/api/phone-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: verifiedPhone, code: "AUTO_CLAIM_AFTER_LOGIN" }),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.data.alreadyClaimed) {
        setAlreadyClaimed(true);
        localStorage.removeItem(VERIFICATION_STORAGE_KEY);
        localStorage.removeItem(`${VERIFICATION_STORAGE_KEY}_${verifiedPhone.replace(/\D/g, '')}`);
        
        // Redirect to dashboard after successful claim
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else if (data.data.retainVerificationData) {
        // API requests keeping verification data for future attempts
        console.log("No commissions were claimed, retaining verification data");
        alert("We couldn't find commissions to claim with your account. Your verification data has been saved for your next attempt.");
      }
    } else {
      console.error("Error response from verification endpoint:", data.error);
      alert("An error occurred while claiming commissions. Please try again.");
    }
  } catch (error) {
    console.error("Error claiming after login:", error);
    alert("Network error while claiming commissions. Please try again.");
  } finally {
    setIsProcessing(false);
  }
};
```

### 3.5 Scenario: Auto-Claiming During Commission Creation

When a new commission split is created for a phone number already associated with a user:

```typescript
// apps/web/lib/partners/create-partner-commission.ts
// Check if the partner is associated with a user account
const partnerUser = await prisma.partnerUser.findFirst({
  where: { partnerId: recipientPartner.id }
});

// Partner is claimed if there's an associated user
const isClaimed = !!partnerUser;
console.log('Partner claimed status:', isClaimed, partnerUser ? `(User: ${partnerUser.userId})` : '(No user)');

// Create the CommissionSplit record with auto-claiming if needed
await tx.$executeRaw`
  INSERT INTO "CommissionSplit" (
    "id", "commissionId", "partnerId", "phoneNumber", "splitPercent", 
    "earnings", "claimed", "claimedAt", "claimedById", "createdAt", "updatedAt"
  ) VALUES (
    ${splitId}, ${primaryCommission.id}, ${recipientPartner.id}, 
    ${split.phoneNumber}, ${split.splitPercent}, ${splitEarnings}, 
    ${isClaimed}, ${isClaimed ? new Date() : null}, 
    ${isClaimed ? recipientPartner.id : null}, NOW(), NOW()
  )
`;
```

## 4. Edge Cases

### 4.1 Expired Verification Data

Verification data in localStorage expires after a set period (1 hour):

```typescript
// apps/web/app/app.thereflist.com/claim/page-client.tsx
// Key for storing verification data in localStorage
const VERIFICATION_STORAGE_KEY = "reflist_phone_verification_data";
// Set verification data to expire after 1 hour
const VERIFICATION_EXPIRY_MS = 60 * 60 * 1000;

// Check for expiration when component mounts
useEffect(() => {
  const savedData = localStorage.getItem(VERIFICATION_STORAGE_KEY);
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      
      // Check if verification data has expired
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        console.log("Verification data expired");
        localStorage.removeItem(VERIFICATION_STORAGE_KEY);
        setVerificationExpired(true);
        return;
      }
      
      // Otherwise restore verification state
      if (data.verified && data.verifiedPhone && data.unclaimedCommissions) {
        setVerified(data.verified);
        setVerifiedPhone(data.verifiedPhone);
        setUnclaimedCommissions(data.unclaimedCommissions);
      }
    } catch (error) {
      console.error("Error parsing saved verification data:", error);
      localStorage.removeItem(VERIFICATION_STORAGE_KEY);
    }
  }
}, []);
```

### 4.2 Multiple Verification Sessions

To handle multiple phone verifications, we use phone-specific storage keys:

```typescript
// Save verification data with phone-specific key
const storageKey = `${VERIFICATION_STORAGE_KEY}_${phoneNumber.replace(/\D/g, '')}`;

localStorage.setItem(
  storageKey,
  JSON.stringify({
    verified: true,
    verifiedPhone: phoneNumber,
    unclaimedCommissions: commissions,
    expiresAt
  })
);

// Also save to the main key for backward compatibility
localStorage.setItem(
  VERIFICATION_STORAGE_KEY,
  JSON.stringify({
    verified: true,
    verifiedPhone: phoneNumber,
    unclaimedCommissions: commissions,
    expiresAt
  })
);
```

### 4.3 Failed Auto-Claim After Login

If auto-claiming fails, we preserve the verification data for retry:

```typescript
// Server-side preservation flag
if (isAutoClaimAfterLogin && userLoggedIn && !claimedAny) {
  return NextResponse.json({
    success: true,
    message: "Authentication successful but no commissions were claimed",
    data: {
      verified: true,
      hasUnclaimedCommissions: true, // Keep showing as unclaimed
      unclaimedCommissions: [], // Client already has this data
      alreadyClaimed: false,    // Important: Don't set as claimed
      retainVerificationData: true // Signal the client to keep localStorage data
    },
  });
}

// Client-side handling
if (data.data.retainVerificationData) {
  // API is telling us to keep verification data for future attempts
  console.log("No commissions were claimed, retaining verification data");
  
  // Reset processing state but keep verification data
  setIsProcessing(false);
  
  alert("We couldn't find commissions to claim with your account. Your verification data has been saved for your next attempt.");
}
```

## 5. Summary of Business Logic

1. **Phone verification** is the starting point for all commission claiming flows
2. **Partner association** determines who can claim commissions
3. **User-Partner relationship** is many-to-many through the PartnerUser table
4. **Auto-claiming** happens when:
   - A logged-in user verifies their phone
   - A user creates an account through the claim flow
   - A user logs in after verifying their phone
   - A new commission split is created for a phone already associated with a user
5. **Split Handling** uses these rules:
   - If a partner exists for the phone, associate the user with that partner
   - If the user has a default partner, associate the phone with that partner
   - If multiple partners are involved, maintain all associations
6. **Verification Data** expires after 1 hour and supports multiple verification sessions

This document covers the full spectrum of scenarios and edge cases for phone verification and commission claiming in the RefList application. 