import { prisma } from "@dub/prisma";

interface SaleInfo {
  amount: number;
  quantity: number;
}

interface RewardInfo {
  event: "click" | "lead" | "sale";
  type: "percentage" | "flat";
  amount: number;
  maxAmount?: number | null;
  maxDuration?: number | null;
}

// Calculate earnings for a sale based on the reward configuration
export function calculateSaleEarnings({
  reward,
  sale,
}: {
  reward: RewardInfo;
  sale: SaleInfo;
}): number {
  // Only calculate earnings for sale events
  if (reward.event !== "sale") {
    return 0;
  }

  // Calculate earnings based on reward type
  let earnings = 0;
  
  if (reward.type === "percentage") {
    // Percentage of sale amount
    earnings = Math.round(sale.amount * (reward.amount / 100));
  } else {
    // Flat rate per quantity (e.g., per item)
    earnings = reward.amount * sale.quantity;
  }

  // If there's a max amount cap, apply it
  if (typeof reward.maxAmount === "number" && earnings > reward.maxAmount) {
    earnings = reward.maxAmount;
  }

  return earnings;
}

// For admin manual sales, apply a default commission rate when no program is specified
export function calculateDefaultEarnings(amount: number): number {
  // Default to commission rate of 50% for manual sales 
  // (on the admin side remember to input the commission amount. 
  // 50% of this is the amount that will be paid out to the user. 
  // We will take the other 50% as our fee.)
  // TODO: This is a temporary function that assumes we are putting in JUST the commission amount we earned (NOT the total amount of the sale)
  // In production we should put in the total amount of the sale, since the reward variable we pass to calculateSaleEarnings is the shopmy commission percentage.
  const defaultCommissionRate = 0.5;
  return Math.floor(amount * defaultCommissionRate);
}

// Calculate earnings based on manually entered commission amount and split percentage
export function calculateManualEarnings({
  commissionAmount,
  splitPercentage,
}: {
  commissionAmount: number;
  splitPercentage: number;
}): number {
  // Ensure split percentage is between 0 and 100
  const validSplitPercentage = Math.max(0, Math.min(100, splitPercentage));
  
  // Calculate earnings based on the commission amount and split percentage
  const earnings = Math.floor(commissionAmount * (validSplitPercentage / 100));
  
  return earnings;
}

// Helper to look up a program's reward structure and calculate earnings
export async function calculateProgramEarnings({
  programId,
  amount,
  quantity = 1,
}: {
  programId: string | null;
  amount: number;
  quantity?: number;
}): Promise<number> {
  if (!programId) {
    return calculateDefaultEarnings(amount);
  }

  try {
    // Look up the program's default reward
    const program = await prisma.program.findUnique({
      where: {
        id: programId,
      },
      include: {
        defaultReward: true,
      },
    });

    if (!program?.defaultReward) {
      return calculateDefaultEarnings(amount);
    }

    // Calculate earnings based on the program's default reward
    return calculateSaleEarnings({
      reward: {
        event: "sale",
        type: program.defaultReward.type,
        amount: program.defaultReward.amount,
        maxAmount: program.defaultReward.maxAmount ?? undefined,
      },
      sale: {
        amount,
        quantity,
      },
    });
  } catch (error) {
    console.error("Error calculating program earnings:", error);
    return calculateDefaultEarnings(amount);
  }
}

// Enhanced helper that supports manual override of earnings calculation
export async function calculateProgramEarningsWithOverride({
  programId,
  amount,
  quantity = 1,
  commissionAmount,
  splitPercentage,
}: {
  programId: string | null;
  amount: number;
  quantity?: number;
  commissionAmount?: number; 
  splitPercentage?: number;
}): Promise<number> {
  // If commission amount and split percentage are provided, use manual calculation
  if (commissionAmount !== undefined && splitPercentage !== undefined) {
    return calculateManualEarnings({ commissionAmount, splitPercentage });
  }
  
  // Otherwise, use the existing calculation logic
  return calculateProgramEarnings({ programId, amount, quantity });
}
