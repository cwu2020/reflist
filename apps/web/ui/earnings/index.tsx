"use client";

import { MaxWidthWrapper } from "@dub/ui";
import { EarningsWallet } from "./earnings-wallet";
import { EarningsChart } from "./earnings-chart";
import { EarningsTable } from "./earnings-table";
import { PayoutsTable } from "./payouts-table";

export { EarningsWallet } from "./earnings-wallet";
export { EarningsChart } from "./earnings-chart";
export { EarningsTable } from "./earnings-table";
export { PayoutsTable } from "./payouts-table";
export { WithdrawModal } from "./withdraw-modal";
export { PayoutDetailsSheet } from "./payout-details-sheet";

export default function Earnings() {
  return (
    <MaxWidthWrapper className="flex flex-col gap-6">
      {/* Wallet Module showing balance summary */}
      <EarningsWallet />
      
      {/* Earnings Chart component */}
      <EarningsChart />
      
      {/* Earnings Table component */}
      <EarningsTable />
      
      {/* Payouts Table component */}
      <PayoutsTable />
    </MaxWidthWrapper>
  );
} 