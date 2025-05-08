import { prisma } from "@dub/prisma";
import { EventType } from "@dub/prisma/client";
import { log } from "@dub/utils";
import { differenceInMonths } from "date-fns";
import { createId } from "../api/create-id";
import { calculateSaleEarnings } from "../api/sales/calculate-sale-earnings";
import { getOrCreatePartnerByPhone } from "../api/partners/get-or-create-partner-by-phone";
import { RewardProps } from "../types";
import { determinePartnerReward } from "./determine-partner-reward";

// Define the CommissionSplit type for the JSON field
type LinkCommissionSplit = {
  phoneNumber: string;
  splitPercent: number;
};

export const createPartnerCommission = async ({
  reward,
  event,
  programId,
  partnerId,
  linkId,
  customerId,
  eventId,
  invoiceId,
  amount = 0,
  quantity,
  currency,
  calculatedEarnings,
}: {
  // we optionally let the caller pass in a reward to avoid a db call
  // (e.g. in aggregate-clicks route)
  reward?: RewardProps | null;
  event: EventType;
  partnerId: string;
  programId: string;
  linkId: string;
  customerId?: string;
  eventId?: string;
  invoiceId?: string | null;
  amount?: number;
  quantity: number;
  currency?: string;
  calculatedEarnings?: number;
}) => {
  if (!reward) {
    reward = await determinePartnerReward({
      event,
      partnerId,
      programId,
    });

    if (!reward) {
      console.log(
        `Partner ${partnerId} has no reward for ${event} event, skipping commission creation...`,
      );
      return;
    }
  }

  // handle sale rewards that have a max duration limit
  if (reward.event === "sale" && typeof reward.maxDuration === "number") {
    // Get the first commission (earliest sale) for this customer-partner pair
    const firstCommission = await prisma.commission.findFirst({
      where: {
        partnerId,
        customerId,
        type: "sale",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (firstCommission) {
      if (reward.maxDuration === 0) {
        console.log(
          `Partner ${partnerId} is only eligible for first-sale commissions, skipping commission creation...`,
        );
        return;
      } else {
        // Calculate months difference between first commission and now
        const monthsDifference = differenceInMonths(
          new Date(),
          firstCommission.createdAt,
        );

        if (monthsDifference >= reward.maxDuration) {
          console.log(
            `Partner ${partnerId} has reached max duration for ${event} event, skipping commission creation...`,
          );
          return;
        }
      }
    }
  }

  // If calculatedEarnings is provided, use that instead of calculating
  let earnings = calculatedEarnings;
  
  // Only calculate earnings if not provided
  if (earnings === undefined) {
    earnings =
      event === "sale"
        ? calculateSaleEarnings({
            reward,
            sale: {
              quantity,
              amount,
            },
          })
        : reward.amount * quantity;
  }

  // handle rewards with max reward amount limit
  if (reward.maxAmount) {
    const totalRewards = await prisma.commission.aggregate({
      where: {
        earnings: {
          gt: 0,
        },
        programId,
        partnerId,
        status: {
          in: ["pending", "processed", "paid"],
        },
        type: event,
      },
      _sum: {
        earnings: true,
      },
    });
    const totalEarnings = totalRewards._sum.earnings || 0;
    if (totalEarnings >= reward.maxAmount) {
      console.log(
        `Partner ${partnerId} has reached max reward amount for ${event} event, skipping commission creation...`,
      );
      return;
    }
    const remainingRewardAmount = reward.maxAmount - totalEarnings;
    earnings = Math.max(0, Math.min(earnings, remainingRewardAmount));
  }

  try {
    // Get link details to check for commission splits
    // Use any type to bypass type checking for JSON fields
    const link = await prisma.link.findUnique({
      where: { id: linkId }
    }) as any;

    // Check if this link has commission splits configured
    let commissionSplits: LinkCommissionSplit[] = [];
    
    console.log('Link details:', { 
      linkId, 
      hasCommissionSplits: !!link.commissionSplits,
      rawCommissionSplits: link.commissionSplits,
      typeOfSplits: typeof link.commissionSplits
    });
    
    if (link && link.commissionSplits) {
      try {
        // Handle both cases: already parsed object or string that needs parsing
        if (typeof link.commissionSplits === 'string') {
          commissionSplits = JSON.parse(link.commissionSplits) as LinkCommissionSplit[];
        } else if (Array.isArray(link.commissionSplits)) {
          commissionSplits = link.commissionSplits as LinkCommissionSplit[];
        } else {
          // If it's an object but not an array, put it in an array
          commissionSplits = [link.commissionSplits] as LinkCommissionSplit[];
        }
        console.log('Parsed commissionSplits:', commissionSplits);
      } catch (error) {
        console.error("Error parsing commissionSplits JSON", error);
      }
    }

    // If no splits defined, create commission as normal
    if (!commissionSplits || commissionSplits.length === 0) {
      console.log('No commission splits found, creating normal commission');
      const commission = await prisma.commission.create({
        data: {
          id: createId({ prefix: "cm_" }),
          programId,
          partnerId,
          customerId,
          linkId,
          eventId,
          invoiceId,
          quantity,
          amount,
          type: event,
          currency,
          earnings,
        },
      });
      return commission;
    }

    console.log('Processing commission splits:', { 
      numberOfSplits: commissionSplits.length,
      totalEarnings: earnings
    });

    // Calculate creator's share (primary partner)
    const totalSplitPercent = commissionSplits.reduce((sum, split) => sum + split.splitPercent, 0);
    const creatorPercent = 100 - totalSplitPercent;
    const creatorEarnings = Math.floor(earnings * (creatorPercent / 100));
    
    console.log('Split calculations:', {
      totalSplitPercent,
      creatorPercent,
      creatorEarnings,
      originalEarnings: earnings
    });
    
    // Create primary commission for the creator
    console.log('Creating primary commission for creator with ID:', partnerId);
    const primaryCommission = await prisma.commission.create({
      data: {
        id: createId({ prefix: "cm_" }),
        programId,
        partnerId, // Original partner (link creator)
        customerId,
        linkId,
        eventId,
        invoiceId,
        quantity,
        amount,
        type: event,
        currency,
        earnings: creatorEarnings,
      },
    });
    console.log('Primary commission created:', primaryCommission.id);
    
    // Process each split
    for (const split of commissionSplits) {
      const splitEarnings = Math.floor(earnings * (split.splitPercent / 100));
      console.log('Processing split for', split.phoneNumber, 'with earnings', splitEarnings);
      
      // Use our new function to get or create a partner by phone number
      let recipientPartner;
      try {
        console.log('Looking up or creating partner for phone:', split.phoneNumber);
        recipientPartner = await getOrCreatePartnerByPhone(
          split.phoneNumber,
          `Split Recipient (${split.phoneNumber})`
        );
        console.log('Retrieved/created partner:', recipientPartner.id);
      } catch (error) {
        console.error(`Error getting/creating partner for phone ${split.phoneNumber}:`, error);
        // Continue with next split if partner creation fails
        continue;
      }
      
      // Check if the partner is associated with a user account
      const partnerUser = await prisma.partnerUser.findFirst({
        where: { partnerId: recipientPartner.id }
      });
      
      // Partner is claimed if there's an associated user
      const isClaimed = !!partnerUser;
      console.log('Partner claimed status:', isClaimed, partnerUser ? `(User: ${partnerUser.userId})` : '(No user)');
      
      // Create a commission and split record in a transaction 
      try {
        console.log('Starting transaction for split commission');
        await prisma.$transaction(async (tx) => {
          // Create a commission for the recipient
          console.log('Creating split commission for recipient:', recipientPartner.id);
          const splitCommission = await tx.commission.create({
            data: {
              id: createId({ prefix: "cm_" }),
              programId,
              partnerId: recipientPartner.id,
              customerId,
              linkId,
              eventId: `${eventId}_split_${recipientPartner.id}`,
              invoiceId: invoiceId ? `${invoiceId}_split_${recipientPartner.id}` : null,
              quantity,
              amount,
              type: event,
              currency,
              earnings: splitEarnings,
            },
          });
          console.log('Split commission created:', splitCommission.id);

          // Create the split record through SQL since the model may not be available in the client yet
          console.log('Creating CommissionSplit record with SQL');
          const splitId = createId({ prefix: "cm_" });
          console.log('CommissionSplit data:', {
            id: splitId,
            commissionId: primaryCommission.id,
            partnerId: recipientPartner.id,
            phoneNumber: split.phoneNumber,
            splitPercent: split.splitPercent,
            earnings: splitEarnings,
            claimed: isClaimed
          });
          
          try {
            await tx.$executeRaw`
              INSERT INTO CommissionSplit (
                id, commissionId, partnerId, phoneNumber, splitPercent, 
                earnings, claimed, createdAt, updatedAt
              ) VALUES (
                ${splitId}, 
                ${primaryCommission.id}, 
                ${recipientPartner.id}, 
                ${split.phoneNumber}, 
                ${split.splitPercent}, 
                ${splitEarnings}, 
                ${isClaimed}, 
                NOW(), 
                NOW()
              )
            `;
            console.log('CommissionSplit record created successfully');
          } catch (sqlError) {
            console.error('SQL Error creating CommissionSplit:', sqlError);
            console.log('Trying alternate column format...');
            
            // Try with backticks around column names in case that's the issue
            try {
              await tx.$executeRaw`
                INSERT INTO CommissionSplit (
                  \`id\`, \`commissionId\`, \`partnerId\`, \`phoneNumber\`, \`splitPercent\`, 
                  \`earnings\`, \`claimed\`, \`createdAt\`, \`updatedAt\`
                ) VALUES (
                  ${splitId}, 
                  ${primaryCommission.id}, 
                  ${recipientPartner.id}, 
                  ${split.phoneNumber}, 
                  ${split.splitPercent}, 
                  ${splitEarnings}, 
                  ${isClaimed}, 
                  NOW(), 
                  NOW()
                )
              `;
              console.log('CommissionSplit record created successfully with alternate format');
            } catch (backticksError) {
              console.error('SQL Error (backticks attempt):', backticksError);
              
              // Try with lowercase table name
              try {
                console.log('Trying lowercase table name...');
                await tx.$executeRaw`
                  INSERT INTO commissionsplit (
                    id, commissionId, partnerId, phoneNumber, splitPercent, 
                    earnings, claimed, createdAt, updatedAt
                  ) VALUES (
                    ${splitId}, 
                    ${primaryCommission.id}, 
                    ${recipientPartner.id}, 
                    ${split.phoneNumber}, 
                    ${split.splitPercent}, 
                    ${splitEarnings}, 
                    ${isClaimed}, 
                    NOW(), 
                    NOW()
                  )
                `;
                console.log('commissionsplit record created successfully with lowercase name');
              } catch (lowercaseError) {
                console.error('SQL Error (lowercase attempt):', lowercaseError);
                throw lowercaseError; // Re-throw to be caught by outer try/catch
              }
            }
          }
        });
        console.log('Transaction completed successfully');
      } catch (error) {
        console.error('Error in split transaction:', error);
      }
      
      // Log the split for tracking purposes
      console.log(`Commission split created for partner ${recipientPartner.id} with phone ${split.phoneNumber}, claimed status: ${isClaimed}`);
    }
    
    console.log('All commission splits processed, returning primary commission');
    return primaryCommission;
  } catch (error) {
    console.error("Error creating commission", error);

    await log({
      message: `Error creating commission - ${error.message}`,
      type: "errors",
      mention: true,
    });

    return;
  }
};
