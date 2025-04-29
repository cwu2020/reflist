"use client";

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
import { PayoutDetailsSheet } from "./payout-details-sheet";

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

export function PayoutsTable() {
  const { queryParams, searchParamsObj } = useRouterStuff();
  const [selectedPayout, setSelectedPayout] = useState<PayoutResponse | null>(null);
  
  const { sortBy = "createdAt", sortOrder = "desc" } = searchParamsObj as {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };

  // Mock data
  const mockData = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const createdAt = new Date(Date.now() - i * 30 * 86400000);
      const periodStart = new Date(createdAt);
      periodStart.setDate(1);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);
      
      return {
        id: `pyt_${i}`,
        amount: Math.floor(Math.random() * 200000) + 50000,
        currency: "USD",
        status: i === 0 
          ? PayoutStatus.pending 
          : i === 1 
            ? PayoutStatus.processing 
            : i === 4 
              ? PayoutStatus.failed 
              : PayoutStatus.completed,
        periodStart,
        periodEnd,
        createdAt,
        paidAt: i > 1 && i !== 4 ? new Date(createdAt.getTime() + 2 * 86400000) : null,
      } as PayoutResponse;
    });
  }, []);

  const isLoading = false;
  const totalCount = 5; // Mock total count

  const { pagination, setPagination } = usePagination();

  const table = useTable({
    data: mockData,
    loading: isLoading,
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
        header: "Status",
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
    rowCount: totalCount,
    emptyState: (
      <AnimatedEmptyState
        title="No payouts found"
        description="No payouts have been processed yet."
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
      
      <Table
        {...table}
        containerClassName="border-neutral-200"
      />
      
      {selectedPayout && (
        <PayoutDetailsSheet
          payout={selectedPayout}
          setIsOpen={() => setSelectedPayout(null)}
        />
      )}
    </div>
  );
} 