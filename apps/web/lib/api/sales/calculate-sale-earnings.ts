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
  // Default to 10% commission for manual sales
  const defaultCommissionRate = 0.1;
  return Math.floor(amount * defaultCommissionRate);
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
