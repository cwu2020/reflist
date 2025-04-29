import { ExpandedLinkProps } from "@/lib/types";

// Extend the LinkFormData to include productUrl field
export interface LinkFormData extends ExpandedLinkProps {
  productUrl?: string; // The user-entered product URL
} 