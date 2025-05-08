import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPhoneNumber } from "@/lib/verification/phone-verification";
import { prisma } from "@dub/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createId } from "@/lib/api/create-id";

// Rate limiting - 10 attempts per minute per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

// Define types for the commission data
type CommissionData = {
  id: string;
  amount?: number;
  currency?: string;
  earnings: number;
  linkTitle?: string;
  date: Date;
};

export async function POST(req: Request) {
  try {
    // Apply rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    await limiter.check(10, ip); // 10 requests per minute per IP
    
    const { phoneNumber, code } = await req.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "Phone number and verification code are required" },
        { status: 400 }
      );
    }

    // Check if this is a post-login auto-claim request
    const isAutoClaimAfterLogin = code === "AUTO_CLAIM_AFTER_LOGIN";
    
    // Only verify the code for normal verifications (not auto-claims)
    let verificationResult = { success: true, message: "Auto-claim after login" };
    
    if (!isAutoClaimAfterLogin) {
      // Verify the code normally
      verificationResult = await verifyPhoneNumber(phoneNumber, code);

      if (!verificationResult.success) {
        console.error(`Verification failed for ${phoneNumber}: ${verificationResult.message}`);
        return NextResponse.json(
          { error: verificationResult.message },
          { status: 400 }
        );
      }
    } else {
      // For auto-claim, ensure the user is logged in
      const authSession = await getServerSession(authOptions);
      if (!authSession?.user) {
        console.error(`Authentication required for auto-claim with phone ${phoneNumber}`);
        return NextResponse.json(
          { error: "Authentication required for auto-claiming" },
          { status: 401 }
        );
      }
      
      console.log(`Auto-claim verification bypassed for ${phoneNumber} with logged in user ${(authSession.user as any).id}`);
    }

    // Check if the user is logged in
    let session;
    let userId;
    let userDefaultPartnerId;
    let userLoggedIn = false;

    try {
      session = await getServerSession(authOptions);
      // Using type assertion since TypeScript doesn't know the extended session properties
      const user = session?.user as { id?: string; defaultPartnerId?: string } | undefined;
      userId = user?.id;
      userDefaultPartnerId = user?.defaultPartnerId;
      userLoggedIn = !!userId;
      
      if (userLoggedIn) {
        console.log(`User authenticated: ${userId}, defaultPartnerId: ${userDefaultPartnerId || 'none'}`);
      } else {
        console.log('No authenticated user found in session');
      }
    } catch (sessionError) {
      console.error("Error retrieving user session:", sessionError);
      // Continue without authentication - treat as not logged in
      userId = undefined;
      userDefaultPartnerId = undefined;
      userLoggedIn = false;
      
      // If this was an auto-claim attempt, return an auth error
      if (isAutoClaimAfterLogin) {
        return NextResponse.json(
          { error: "Authentication required for auto-claiming. Please sign in again." },
          { status: 401 }
        );
      }
    }

    let claimedAny = false;
    let claimedCommissions: any[] = []; // Store claimed commissions for the response

    // If user is logged in AND this is an auto-claim request, handle commission claiming
    if (userLoggedIn && userId && isAutoClaimAfterLogin) {
      try {
        await prisma.$transaction(async (tx) => {
          // Log transaction start for debugging
          console.log(`Starting commission claim transaction for user ${userId} with phone ${phoneNumber}`);
          
          // First, check if this phone number is already associated with an existing partner
          // Using raw query since phoneNumber might not be in the Prisma Partner schema
          const partnersResult = await tx.$queryRaw`
            SELECT * FROM \`Partner\` WHERE \`phoneNumber\` = ${phoneNumber} LIMIT 1
          `;
          
          const partners = Array.isArray(partnersResult) ? partnersResult : [];
          const existingPartnerWithPhone = partners.length > 0 ? partners[0] : null;
          let partnerIdForClaiming = userDefaultPartnerId;
          
          // If a partner exists with this phone number
          if (existingPartnerWithPhone) {
            console.log(`Found existing partner with phone: ${existingPartnerWithPhone.id}`);
            
            // Associate this partner with the user if not already associated
            const existingAssociation = await tx.partnerUser.findUnique({
              where: {
                userId_partnerId: {
                  userId: userId,
                  partnerId: existingPartnerWithPhone.id
                }
              }
            });
            
            if (!existingAssociation) {
              // Create association between user and partner
              await tx.partnerUser.create({
                data: {
                  userId: userId,
                  partnerId: existingPartnerWithPhone.id,
                  role: 'owner'
                }
              });
              
              console.log(`Associated user ${userId} with partner ${existingPartnerWithPhone.id}`);
            } else {
              console.log(`User ${userId} was already associated with partner ${existingPartnerWithPhone.id}`);
            }
            
            // If user doesn't have a default partner ID yet, set this one as default
            if (!userDefaultPartnerId) {
              await tx.user.update({
                where: { id: userId },
                data: { defaultPartnerId: existingPartnerWithPhone.id }
              });
              
              userDefaultPartnerId = existingPartnerWithPhone.id;
              partnerIdForClaiming = existingPartnerWithPhone.id;
              console.log(`Set partner ${existingPartnerWithPhone.id} as default for user ${userId}`);
            } else {
              // Use the partner with the phone number for claiming
              partnerIdForClaiming = existingPartnerWithPhone.id;
            }
          } else if (userDefaultPartnerId) {
            // Update the user's default partner with the phone number using raw SQL
            await tx.$executeRaw`
              UPDATE \`Partner\` SET \`phoneNumber\` = ${phoneNumber} 
              WHERE id = ${userDefaultPartnerId}
            `;
            
            console.log(`Updated partner ${userDefaultPartnerId} with phone ${phoneNumber}`);
          }
          
          if (!partnerIdForClaiming) {
            console.error("No valid partner ID found for claiming commissions");
            throw new Error("No valid partner ID for claiming");
          }
          
          // Find all unclaimed commission splits for this phone number
          // We'll still use raw queries here if CommissionSplit isn't in the Prisma schema
          const commissionSplits = await tx.$queryRaw`
            SELECT s.*, c.* FROM \`CommissionSplit\` s
            LEFT JOIN \`Commission\` c ON s.\`commissionId\` = c.id
            WHERE s.\`phoneNumber\` = ${phoneNumber} AND s.claimed = false
          `;
          
          const splits = Array.isArray(commissionSplits) ? commissionSplits : [];
          claimedCommissions = [...splits]; // Save for response
          
          console.log(`Found ${splits.length} unclaimed commission splits for logged-in user`);
          
          // Check if there are any commissions to claim
          if (splits.length > 0) {
            claimedAny = true;
            
            // Mark the commission splits as claimed by this partner
            for (const split of splits) {
              try {
                // Try to use Prisma's update method if possible
                await tx.$executeRaw`
                  UPDATE \`CommissionSplit\` 
                  SET claimed = true, 
                      \`claimedAt\` = NOW(), 
                      \`claimedById\` = ${partnerIdForClaiming},
                      \`partnerId\` = ${partnerIdForClaiming}
                  WHERE id = ${split.id}
                `;
                
                console.log(`Successfully marked commission split ${split.id} as claimed by partner ${partnerIdForClaiming}`);
              } catch (error) {
                console.error(`Error updating commission split ${split.id}:`, error);
                throw error; // Re-throw to roll back the transaction
              }
            }
            
            console.log(`Successfully claimed ${splits.length} commission splits for user ${userId} with partner ${partnerIdForClaiming}`);
          } else {
            console.log(`No unclaimed commission splits found for phone ${phoneNumber}`);
          }
          
          // Remove legacy commission handling completely as it's not applicable
          console.log(`Transaction for user ${userId} with phone ${phoneNumber} completing`);
        });
        
        console.log("Commission claim transaction completed successfully");

        // Double-check the database state to confirm commissions were actually claimed
        try {
          const verificationCheck = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM \`CommissionSplit\` 
            WHERE \`phoneNumber\` = ${phoneNumber} AND claimed = true
          `;
          
          const count = Array.isArray(verificationCheck) && verificationCheck.length > 0 
            ? verificationCheck[0].count 
            : 0;
          
          console.log(`Post-transaction verification: Found ${count} claimed commission splits for phone ${phoneNumber}`);
          
          if (count > 0) {
            claimedAny = true;
            
            // If commissions were successfully claimed, clean up any verification tokens
            try {
              // Use rawSQL to directly delete the tokens without relying on composite keys
              await prisma.$executeRaw`
                DELETE FROM \`PhoneVerificationToken\`
                WHERE \`identifier\` = ${phoneNumber}
              `;
              console.log(`Cleaned up verification tokens for ${phoneNumber} after successful claim`);
            } catch (cleanupError) {
              console.error("Error cleaning up verification tokens:", cleanupError);
              // Non-critical error, we can continue
            }
          }
        } catch (error) {
          console.error("Error in post-transaction verification:", error);
        }
      } catch (error) {
        console.error("Error during commission claiming transaction:", error);
        // Return a partial failure but allow the verification to continue
        return NextResponse.json({
          success: true,
          message: "Phone verified but error claiming commissions",
          data: {
            verified: true,
            hasUnclaimedCommissions: true,
            unclaimedCommissions: [],
            error: "Failed to claim commissions due to a database error"
          },
        });
      }
    }

    // If user is logged in and claimed commissions, return success
    if (userLoggedIn && claimedAny) {
      return NextResponse.json({
        success: true,
        message: "Phone number verified and commissions claimed successfully",
        data: {
          verified: true,
          hasUnclaimedCommissions: false,
          unclaimedCommissions: [],
          claimedCommissions: claimedCommissions,
          claimedCount: claimedCommissions.length,
          alreadyClaimed: true
        },
      });
    }
    
    // If this is an auto-claim but nothing was claimed, return partial success
    // This allows the client to keep the verification data for future attempts
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

    // For non-logged in users or if no commissions were claimed yet, get unclaimed commissions
    let unclaimedCommissions: CommissionData[] = [];
    try {
      // Using raw query to get commission splits since it might not be in the prisma client
      const splitsQuery = await prisma.$queryRaw`
        SELECT s.*, s.\`createdAt\` as date, s.earnings
        FROM \`CommissionSplit\` s
        WHERE s.\`phoneNumber\` = ${phoneNumber} AND s.claimed = false
      `;
      
      const splits = Array.isArray(splitsQuery) ? splitsQuery : [];
      
      // Use the splits directly even if commission data is missing
      unclaimedCommissions = splits.map(split => ({
        id: split.id,
        // Default values if commission data isn't available
        amount: 0, 
        currency: "USD",
        earnings: split.earnings,
        linkTitle: "Commission", 
        date: split.date || split.createdAt,
      }));

      // Try to enhance with commission data where possible, but don't fail if it's not available
      try {
        for (let i = 0; i < unclaimedCommissions.length; i++) {
          const split = splits[i];
          if (split.commissionId) {
            const commissionsQuery = await prisma.$queryRaw`
              SELECT c.*, l.title as linkTitle
              FROM \`Commission\` c
              LEFT JOIN \`Link\` l ON c.\`linkId\` = l.id
              WHERE c.id = ${split.commissionId}
            `;
            
            if (Array.isArray(commissionsQuery) && commissionsQuery.length > 0) {
              const commission = commissionsQuery[0];
              unclaimedCommissions[i] = {
                ...unclaimedCommissions[i],
                amount: commission.amount,
                currency: commission.currency,
                linkTitle: commission.linkTitle || "Unknown Link",
              };
            }
          }
        }
      } catch (error) {
        console.error("Error fetching commission details:", error);
        // Continue with basic data if commission details can't be fetched
      }
      
    } catch (error) {
      console.error("Error fetching commission splits:", error);
      // If there's an error with the query, just return empty commissions
      unclaimedCommissions = [];
    }

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
  } catch (error: any) {
    if (error.message === "Rate limit exceeded") {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }
    
    console.error("Error verifying phone number:", error);
    return NextResponse.json(
      { error: "Failed to verify phone number" },
      { status: 500 }
    );
  }
} 