"use client";

import { useState } from "react";
import {
  Table,
  useTable,
  Button,
  StatusBadge
} from "@dub/ui";
import { CommissionStatusBadges } from "@/ui/partners/commission-status-badges";
import { PayoutStatusBadges } from "@/ui/partners/payout-status-badges";
import { CommissionStatus, PayoutStatus } from "@dub/prisma/client";
import { fetcher, currencyFormatter, formatDateTime } from "@dub/utils";
import { AnalyticsLoadingSpinner } from "@/ui/analytics/analytics-loading-spinner";
import useSWR from "swr";
import { X } from "lucide-react";
import { PayoutActions } from "./payout-actions";

// Create a simple modal component
function Modal({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="h-full w-full">{children}</div>
      </div>
    </div>
  );
}

interface Commission {
  id: string;
  amount: number;
  earnings: number;
  currency: string;
  status: CommissionStatus;
  createdAt: string;
  linkKey: string;
}

interface PayoutDetails {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  programId: string;
  programName: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  createdAt: string;
  paidAt: string | null;
  description: string | null;
  stripeTransferId: string | null;
}

interface ApiResponse {
  payout: PayoutDetails;
  commissions: Commission[];
}

interface PayoutDetailsSheetProps {
  payoutId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export function PayoutDetailsSheet({ payoutId, open, onOpenChange, onStatusChange }: PayoutDetailsSheetProps) {
  // Fetch payout details and commissions
  const { data, isLoading, error, mutate } = useSWR<ApiResponse>(
    open ? `/api/admin/payouts/${payoutId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );
  
  const payout = data?.payout;
  const commissions = data?.commissions || [];
  
  // Set up table for commissions
  const commissionTable = useTable({
    data: commissions,
    columns: [
      {
        header: "Date",
        cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
      },
      {
        header: "Link",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{row.original.linkKey}</span>
          </div>
        ),
      },
      {
        header: "Sale Amount",
        cell: ({ row }) => (
          <span>{currencyFormatter(row.original.amount / 100)}</span>
        ),
      },
      {
        header: "Earnings",
        cell: ({ row }) => (
          <span className="font-medium">{currencyFormatter(row.original.earnings / 100)}</span>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const badge = CommissionStatusBadges[row.original.status];
          return (
            <StatusBadge icon={badge.icon} variant={badge.variant}>
              {badge.label}
            </StatusBadge>
          );
        },
      },
    ],
    resourceName: () => "commission",
    loading: isLoading && open,
    rowCount: commissions.length,
  });
  
  // Handle status updates
  const handleStatusUpdate = () => {
    mutate();
    if (onStatusChange) {
      onStatusChange();
    }
  };
  
  return (
    <Modal open={open} onClose={() => onOpenChange(false)}>
      <div>
        <div className="mb-4 border-b border-neutral-200 p-4 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Payout Details</h2>
            <button 
              onClick={() => onOpenChange(false)} 
              className="rounded-full p-1 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <AnalyticsLoadingSpinner />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            Error loading payout details
          </div>
        ) : payout ? (
          <div className="space-y-6 p-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 p-4">
              <div>
                <h3 className="text-xs font-medium text-neutral-500">Partner</h3>
                <p className="font-medium">{payout.partnerName}</p>
                <p className="text-xs text-neutral-500">{payout.partnerEmail}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-neutral-500">Program</h3>
                <p className="font-medium">{payout.programName}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-neutral-500">Status</h3>
                <div className="mt-1">
                  {payout.status && (
                    <StatusBadge
                      variant={PayoutStatusBadges[payout.status].variant}
                      icon={PayoutStatusBadges[payout.status].icon}
                    >
                      {PayoutStatusBadges[payout.status].label}
                    </StatusBadge>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-neutral-500">Amount</h3>
                <p className="font-medium">{currencyFormatter(payout.amount / 100)}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-neutral-500">Created</h3>
                <p>{formatDateTime(new Date(payout.createdAt))}</p>
              </div>
              
              {payout.paidAt && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500">Paid</h3>
                  <p>{formatDateTime(new Date(payout.paidAt))}</p>
                </div>
              )}
              
              {payout.stripeTransferId && (
                <div className="col-span-2">
                  <h3 className="text-xs font-medium text-neutral-500">Stripe Transfer ID</h3>
                  <p className="font-mono text-xs">{payout.stripeTransferId}</p>
                </div>
              )}
              
              <div className="col-span-2">
                <h3 className="text-xs font-medium text-neutral-500">Description</h3>
                <p>{payout.description || "No description provided"}</p>
              </div>
            </div>
            
            <div>
              <h3 className="mb-2 font-medium">Update Status</h3>
              <PayoutActions 
                payoutId={payout.id} 
                currentStatus={payout.status}
                onStatusUpdate={handleStatusUpdate}
              />
            </div>
            
            <div>
              <h3 className="mb-2 font-medium">Commissions ({commissions.length})</h3>
              {commissions.length ? (
                <Table {...commissionTable} />
              ) : (
                <div className="rounded-lg border border-neutral-200 p-4 text-center">
                  <p className="text-neutral-500">No commissions associated with this payout</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
} 