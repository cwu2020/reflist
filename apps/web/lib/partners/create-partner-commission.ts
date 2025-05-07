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

  let earnings =
    event === "sale"
      ? calculateSaleEarnings({
          reward,
          sale: {
            quantity,
            amount,
          },
        })
      : reward.amount * quantity;

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
      rawCommissionSplits: link.commissionSplits
    });
    
    if (link && link.commissionSplits) {
      try {
        // Parse the JSON data into our type
        commissionSplits = JSON.parse(JSON.stringify(link.commissionSplits)) as LinkCommissionSplit[];
        console.log('Parsed commissionSplits:', commissionSplits);
      } catch (error) {
        console.error("Error parsing commissionSplits JSON", error);
      }
    }

    // If no splits defined, create commission as normal
    if (!commissionSplits || commissionSplits.length === 0) {
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

    // Calculate creator's share (primary partner)
    const totalSplitPercent = commissionSplits.reduce((sum, split) => sum + split.splitPercent, 0);
    const creatorPercent = 100 - totalSplitPercent;
    const creatorEarnings = Math.floor(earnings * (creatorPercent / 100));
    
    // Create primary commission for the creator
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
    
    // Process each split
    for (const split of commissionSplits) {
      const splitEarnings = Math.floor(earnings * (split.splitPercent / 100));
      
      // Use our new function to get or create a partner by phone number
      let recipientPartner;
      try {
        recipientPartner = await getOrCreatePartnerByPhone(
          split.phoneNumber,
          `Split Recipient (${split.phoneNumber})`
        );
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
      
      // Create a commission and split record in a transaction 
      await prisma.$transaction(async (tx) => {
        // Create a commission for the recipient
        const splitCommission = await tx.commission.create({
          data: {
            id: createId({ prefix: "cm_" }),
            programId,
            partnerId: recipientPartner.id,
            customerId,
            linkId,
            eventId: `${eventId}_split_${recipientPartner.id}`,
            invoiceId,
            quantity,
            amount,
            type: event,
            currency,
            earnings: splitEarnings,
          },
        });

        // Create the split record through SQL since the model may not be available in the client yet
        await tx.$executeRaw`
          INSERT INTO CommissionSplit (
            id, commissionId, partnerId, phoneNumber, splitPercent, 
            earnings, claimed, createdAt, updatedAt
          ) VALUES (
            ${createId({ prefix: "cm_" })}, 
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
      });
      
      // Log the split for tracking purposes
      console.log(`Commission split created for partner ${recipientPartner.id} with phone ${split.phoneNumber}, claimed status: ${isClaimed}`);
    }
    
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
