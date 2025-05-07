import { ExpandedLinkProps } from "@/lib/types";

// Define the CommissionSplit type
type CommissionSplit = {
  phoneNumber: string;
  splitPercent: number;
};

// Extend the LinkFormData to include productUrl field and commissionSplits
export interface LinkFormData extends ExpandedLinkProps {
  productUrl?: string; // The user-entered product URL
  commissionSplits?: CommissionSplit[]; // Configuration for commission splits
} 