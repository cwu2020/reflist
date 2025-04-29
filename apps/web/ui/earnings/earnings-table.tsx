"use client";

import { CommissionStatusBadges } from "@/ui/partners/commission-status-badges";
import { CommissionTypeBadge } from "@/ui/partners/commission-type-badge";
import { AnimatedEmptyState } from "@/ui/shared/animated-empty-state";
import {
  CopyText,
  LinkLogo,
  StatusBadge,
  Table,
  usePagination,
  useRouterStuff,
  useTable,
} from "@dub/ui";
import { ChartActivity2, CircleDollar } from "@dub/ui/icons";
import {
  currencyFormatter,
  formatDateTime,
  formatDateTimeSmart,
  getApexDomain,
  getPrettyUrl,
} from "@dub/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

// Mock types for now - will be replaced with actual types
type EarningsResponse = {
  id: string;
  createdAt: Date;
  type: "click" | "lead" | "sale";
  link: {
    id: string;
    shortLink: string;
    url: string;
  };
  customer?: {
    id: string;
    email: string;
  };
  amount: number;
  earnings: number;
  status: "pending" | "processed" | "paid" | "refunded";
};

export function EarningsTable() {
  const { slug } = useParams();
  const { queryParams, searchParamsObj } = useRouterStuff();

  const { sortBy = "createdAt", sortOrder = "desc" } = searchParamsObj as {
    sortBy?: "createdAt" | "amount" | "earnings";
    sortOrder?: "asc" | "desc";
  };

  // Mock data
  const mockData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `cm_${i}`,
      createdAt: new Date(Date.now() - i * 86400000),
      type: i % 3 === 0 ? "click" : i % 3 === 1 ? "lead" : "sale",
      link: {
        id: `link_${i}`,
        shortLink: `dub.sh/${i}`,
        url: `https://example.com/product-${i}`,
      },
      customer: i % 3 === 0 ? undefined : {
        id: `cust_${i}`,
        email: `customer${i}@example.com`,
      },
      amount: i % 3 === 2 ? Math.floor(Math.random() * 10000) + 1000 : 0,
      earnings: Math.floor(Math.random() * 5000) + 500,
      status: i % 4 === 0 ? "pending" : i % 4 === 1 ? "processed" : i % 4 === 2 ? "paid" : "refunded",
    } as EarningsResponse));
  }, []);

  const isLoading = false;
  const error = undefined;
  const totalCount = 53; // Mock total count

  const { pagination, setPagination } = usePagination();

  const { table, ...tableProps } = useTable({
    data: mockData,
    loading: isLoading,
    error: error ? "Failed to fetch earnings." : undefined,
    columns: [
      {
        id: "createdAt",
        header: "Date",
        accessorKey: "timestamp",
        minSize: 140,
        cell: ({ row }) => (
          <p title={formatDateTime(row.original.createdAt)}>
            {formatDateTimeSmart(row.original.createdAt)}
          </p>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorKey: "type",
        cell: ({ row }) => <CommissionTypeBadge type={row.original.type} />,
      },
      {
        id: "link",
        header: "Link",
        accessorKey: "link",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <LinkLogo
              apexDomain={getApexDomain(row.original.link.url)}
              className="size-4 shrink-0 sm:size-4"
            />
            <CopyText
              value={row.original.link.shortLink}
              successMessage="Copied link to clipboard!"
              className="truncate"
            >
              <span className="truncate" title={row.original.link.shortLink}>
                {getPrettyUrl(row.original.link.shortLink)}
              </span>
            </CopyText>
          </div>
        ),
        size: 250,
      },
      {
        id: "customer",
        header: "Customer",
        accessorKey: "customer",
        cell: ({ row }) =>
          row.original.customer ? (
            <Link
              href={`/${slug}/customers/${row.original.customer.id}`}
              scroll={false}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-stone-100"
            >
              <div className="truncate" title={row.original.customer.email}>
                {row.original.customer.email}
              </div>
              <ChartActivity2 className="size-3.5 shrink-0" />
            </Link>
          ) : (
            "-"
          ),
        size: 250,
      },
      {
        id: "amount",
        header: "Sale Amount",
        accessorKey: "amount",
        cell: ({ row }) =>
          row.original.amount
            ? currencyFormatter(row.original.amount / 100)
            : "-",
      },
      {
        id: "earnings",
        header: "Earnings",
        accessorKey: "earnings",
        cell: ({ row }) =>
          currencyFormatter(row.original.earnings / 100),
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const badge = CommissionStatusBadges[row.original.status];

          return (
            <StatusBadge
              icon={null}
              variant={badge.variant}
              tooltip={badge.tooltip({
                holdingPeriodDays: 30,
                minPayoutAmount: 10000,
                supportEmail: "support@thereflist.com",
              })}
            >
              {badge.label}
            </StatusBadge>
          );
        },
      },
    ],
    pagination,
    onPaginationChange: setPagination,
    sortableColumns: ["createdAt", "amount", "earnings"],
    sortBy,
    sortOrder,
    onSortChange: ({ sortBy, sortOrder }) =>
      queryParams({
        set: {
          ...(sortBy && { sortBy }),
          ...(sortOrder && { sortOrder }),
        },
        del: "page",
        scroll: false,
      }),
    enableColumnResizing: true,
    rowCount: totalCount,
    tdClassName: (columnId) => (columnId === "customer" ? "p-0" : ""),
    emptyState: (
      <AnimatedEmptyState
        title="No earnings found"
        description="No earnings have been made yet."
        cardContent={() => (
          <>
            <CircleDollar className="size-4 text-neutral-700" />
            <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
          </>
        )}
      />
    ),
    resourceName: (plural) => `earning${plural ? "s" : ""}`,
  });

  return isLoading || mockData.length ? (
    <Table
      {...tableProps}
      table={table}
      containerClassName="border-neutral-200"
    />
  ) : (
    <AnimatedEmptyState
      title="No earnings found"
      description="No earnings have been made yet."
      cardContent={() => (
        <>
          <CircleDollar className="size-4 text-neutral-700" />
          <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
        </>
      )}
    />
  );
} 