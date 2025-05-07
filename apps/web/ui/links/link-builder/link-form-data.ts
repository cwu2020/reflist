import { ExpandedLinkProps } from "@/lib/types";
import { Prisma } from "@prisma/client";

// Define the CommissionSplit type
export type CommissionSplit = {
  phoneNumber: string;
  splitPercent: number;
};

// Extend the LinkFormData to include productUrl field and commissionSplits
export interface LinkFormData extends ExpandedLinkProps {
  productUrl?: string; // The user-entered product URL
  commissionSplits: Prisma.JsonValue; // Configuration for commission splits
} 