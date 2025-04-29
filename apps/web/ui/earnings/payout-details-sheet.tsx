"use client";

import { PayoutStatus } from "@dub/prisma/client";
import { PayoutStatusBadges } from "@/ui/partners/payout-status-badges";
import { Modal, StatusBadge } from "@dub/ui";
import { CircleDollar } from "@dub/ui/icons";
import { currencyFormatter, formatPeriod } from "@dub/utils";
import { Dispatch, Fragment, SetStateAction, useMemo } from "react";

// Mock types - will be replaced with actual types
type PayoutResponse = {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  paidAt: Date | null;
};

type PayoutDetailsSheetProps = {
  payout: PayoutResponse;
  setIsOpen: Dispatch<SetStateAction<boolean | null>>;
};

export function PayoutDetailsSheet({ payout, setIsOpen }: PayoutDetailsSheetProps) {
  const payoutData = useMemo(() => {
    const statusBadge = PayoutStatusBadges[payout.status];

    return {
      Period: formatPeriod({
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
      }),

      Status: (
        <StatusBadge variant={statusBadge.variant} icon={statusBadge.icon}>
          {statusBadge.label}
        </StatusBadge>
      ),

      Total: currencyFormatter(payout.amount / 100),

      "Created Date": payout.createdAt.toLocaleDateString(),
      
      ...(payout.paidAt && {
        "Processed Date": payout.paidAt.toLocaleDateString(),
      }),
    };
  }, [payout]);

  return (
    <Modal showModal={true} setShowModal={setIsOpen}>
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center space-x-3">
          <CircleDollar className="h-5 w-5 text-neutral-600" />
          <h1 className="text-xl font-medium">Payout Details</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-6">
          <div className="text-base font-medium text-neutral-900">
            Payout information
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(payoutData).map(([key, value]) => (
              <Fragment key={key}>
                <div className="flex items-center font-medium text-neutral-500">
                  {key}
                </div>
                <div className="text-neutral-800">{value}</div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 pt-2">
          <p className="text-sm text-neutral-500">
            {payout.status === PayoutStatus.pending && (
              "This payout is pending and will be processed soon."
            )}
            {payout.status === PayoutStatus.processing && (
              "This payout is being processed and will be completed in 1-3 business days."
            )}
            {payout.status === PayoutStatus.completed && (
              "This payout has been completed and the funds have been sent to your connected account."
            )}
            {payout.status === PayoutStatus.failed && (
              "This payout has failed. Please contact support for assistance."
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
} 