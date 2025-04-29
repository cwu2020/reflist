"use client";

import { PayoutResponse, useWorkspacePayouts } from "@/lib/swr/use-workspace-payouts";
import { PayoutStatus } from "@dub/prisma/client";
import { PayoutStatusBadges } from "@/ui/partners/payout-status-badges";
import { AnimatedEmptyState } from "@/ui/shared/animated-empty-state";
import {
  StatusBadge,
  Table,
  usePagination,
  useRouterStuff,
  useTable,
} from "@dub/ui";
import { CircleDollar } from "@dub/ui/icons";
import { currencyFormatter, formatPeriod } from "@dub/utils";
import { useMemo, useState } from "react";

// Interface for processed payouts with Date objects
interface ProcessedPayout {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  description?: string;
}

interface PayoutDetailsSheetProps {
  payout: ProcessedPayout;
  setIsOpen: (open: boolean) => void;
}

// Temporary placeholder for the PayoutDetailsSheet
// This component can be fully implemented later
function PayoutDetailsSheet({ payout, setIsOpen }: PayoutDetailsSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium">Payout Details</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Period: {formatPeriod({
            periodStart: payout.periodStart,
            periodEnd: payout.periodEnd,
          })}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Amount: {currencyFormatter(payout.amount / 100)}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Status: {PayoutStatusBadges[payout.status]?.label || payout.status}
        </p>
        <button 
          className="mt-4 rounded-md bg-neutral-800 px-4 py-2 text-sm text-white"
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function PayoutsTable() {
  const { queryParams, searchParamsObj } = useRouterStuff();
  const [selectedPayout, setSelectedPayout] = useState<ProcessedPayout | null>(null);
  
  const { sortBy = "createdAt", sortOrder = "desc" } = searchParamsObj as {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };

  // Get payout data from the API
  const { payouts, count, isLoading, error } = useWorkspacePayouts();

  // Process payouts data to handle dates
  const processedPayouts = useMemo<ProcessedPayout[]>(() => {
    if (!payouts?.length) return [];
    
    return payouts.map(payout => ({
      ...payout,
      createdAt: new Date(payout.createdAt),
      periodStart: payout.periodStart ? new Date(payout.periodStart) : null,
      periodEnd: payout.periodEnd ? new Date(payout.periodEnd) : null,
      paidAt: payout.paidAt ? new Date(payout.paidAt) : null,
    }));
  }, [payouts]);

  const { pagination, setPagination } = usePagination();

  const table = useTable({
    data: processedPayouts,
    loading: isLoading,
    error: error ? "Failed to fetch payouts." : undefined,
    columns: [
      {
        id: "periodStart",
        header: "Period",
        accessorFn: (d) => formatPeriod({
          periodStart: d.periodStart,
          periodEnd: d.periodEnd,
        }),
      },
      {
        id: "createdAt",
        header: "Date",
        accessorFn: (d) => d.createdAt.toLocaleDateString(),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const badge = PayoutStatusBadges[row.original.status];
          return badge ? (
            <StatusBadge icon={badge.icon} variant={badge.variant}>
              {badge.label}
            </StatusBadge>
          ) : (
            "-"
          );
        },
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => (
          <div className="font-medium">
            {currencyFormatter(row.original.amount / 100)}
          </div>
        ),
      },
    ],
    pagination,
    onPaginationChange: setPagination,
    sortBy,
    sortOrder,
    onSortChange: ({ sortBy, sortOrder }) =>
      queryParams({
        set: {
          ...(sortBy && { sortBy }),
          ...(sortOrder && { sortOrder }),
        },
      }),
    onRowClick: (row) => {
      setSelectedPayout(row.original);
    },
    thClassName: "border-l-0",
    tdClassName: "border-l-0",
    resourceName: (p) => `payout${p ? "s" : ""}`,
    rowCount: count,
    emptyState: (
      <AnimatedEmptyState
        title="No payouts found"
        description="No payouts have been made yet."
        cardContent={() => (
          <>
            <CircleDollar className="size-4 text-neutral-700" />
            <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
          </>
        )}
      />
    ),
  });

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-neutral-900">Payout History</h2>
      </div>
      
      {isLoading || (processedPayouts.length > 0) ? (
        <Table
          {...table}
          containerClassName="border-neutral-200"
        />
      ) : (
        <AnimatedEmptyState
          title="No payouts found"
          description="No payouts have been made yet."
          cardContent={() => (
            <>
              <CircleDollar className="size-4 text-neutral-700" />
              <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
            </>
          )}
        />
      )}
      
      {selectedPayout && (
        <PayoutDetailsSheet
          payout={selectedPayout}
          setIsOpen={() => setSelectedPayout(null)}
        />
      )}
    </div>
  );
} 