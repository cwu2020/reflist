"use client";

import { useState } from "react";
import { 
  Table, 
  StatusBadge, 
  Button, 
  useTable, 
  usePagination, 
} from "@dub/ui";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher, currencyFormatter, formatDateTime } from "@dub/utils";
import { CommissionStatus, PayoutStatus } from "@dub/prisma/client";
import { CommissionStatusBadges } from "@/ui/partners/commission-status-badges";
import { AnalyticsLoadingSpinner } from "@/ui/analytics/analytics-loading-spinner";
import { Check, CircleCheck } from "@dub/ui/icons";
import { AlertTriangle } from "lucide-react";

// Import or create needed components
import { Sheet } from "@dub/ui";

// Simplified Select component 
function Select({ 
  value, 
  onChange, 
  disabled, 
  placeholder, 
  className, 
  options 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  disabled?: boolean; 
  placeholder: string; 
  className?: string; 
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      disabled={disabled}
      className={`rounded-md border border-neutral-200 px-2 py-1 text-sm ${className}`}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Simple Dialog component
function Dialog({ 
  children, 
  open, 
  setOpen 
}: { 
  children: React.ReactNode; 
  open: boolean; 
  setOpen: (open: boolean) => void;
}) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
}

// Dialog components
Dialog.Content = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
Dialog.Header = ({ children }: { children: React.ReactNode }) => <div className="mb-4">{children}</div>;
Dialog.Title = ({ children }: { children: React.ReactNode }) => <h3 className="text-lg font-medium">{children}</h3>;
Dialog.Description = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-neutral-500">{children}</p>;
Dialog.Footer = ({ children }: { children: React.ReactNode }) => <div className="mt-6 flex justify-end gap-2">{children}</div>;
Dialog.Cancel = ({ children }: { children: React.ReactNode }) => <button className="rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-300">{children}</button>;
Dialog.Action = ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
  <button onClick={onClick} className={`rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 ${className}`}>
    {children}
  </button>
);

// Simple hook to replace useDialogState
function useDialogState() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

// Types for the commission data
interface CommissionData {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  amount: number;
  earnings: number;
  currency: string;
  status: CommissionStatus;
  createdAt: string;
  programId: string;
  programName: string;
  linkId: string;
  linkKey: string;
}

// Group commissions by partner with totals
interface GroupedCommissions {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  commissions: CommissionData[];
  totalEarnings: number;
  totalCommissions: number;
}

export function PendingCommissionsTable() {
  // State for tracking which partner's commissions are being viewed
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [processingCommissionIds, setProcessingCommissionIds] = useState<string[]>([]);
  const [processingPartnerIds, setProcessingPartnerIds] = useState<string[]>([]);
  
  // Dialog for confirmation of payout processing
  const createPayoutDialog = useDialogState();
  const [payoutPartner, setPayoutPartner] = useState<GroupedCommissions | null>(null);
  
  // Fetch pending commissions
  const { data, isLoading, error, mutate } = useSWR<{ commissions: CommissionData[] }>(
    "/api/admin/commissions?status=pending",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );
  
  // Group commissions by partner
  const groupedCommissions: GroupedCommissions[] = data?.commissions 
    ? Object.values(data.commissions.reduce((acc, commission) => {
        if (!acc[commission.partnerId]) {
          acc[commission.partnerId] = {
            partnerId: commission.partnerId,
            partnerName: commission.partnerName,
            partnerEmail: commission.partnerEmail,
            commissions: [],
            totalEarnings: 0,
            totalCommissions: 0
          };
        }
        
        acc[commission.partnerId].commissions.push(commission);
        acc[commission.partnerId].totalEarnings += commission.earnings;
        acc[commission.partnerId].totalCommissions += 1;
        
        return acc;
      }, {} as Record<string, GroupedCommissions>))
    : [];
    
  // Handle changing commission status
  const handleCommissionStatusChange = async (commissionId: string, newStatus: CommissionStatus) => {
    try {
      setProcessingCommissionIds((prev) => [...prev, commissionId]);
      
      const response = await fetch(`/api/admin/commissions/${commissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }
      
      toast.success(`Commission status updated to ${newStatus}`);
      
      // Refresh the data
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
      console.error(error);
    } finally {
      setProcessingCommissionIds((prev) => prev.filter(id => id !== commissionId));
    }
  };
  
  // Handle creating a payout for a partner
  const handleCreatePayout = async (partner: GroupedCommissions) => {
    setPayoutPartner(partner);
    createPayoutDialog.setOpen(true);
  };
  
  // Process the payout for a partner
  const processPartnerPayout = async () => {
    if (!payoutPartner) return;
    
    try {
      setProcessingPartnerIds((prev) => [...prev, payoutPartner.partnerId]);
      createPayoutDialog.setOpen(false);
      
      const response = await fetch(`/api/admin/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partnerId: payoutPartner.partnerId,
          commissionIds: payoutPartner.commissions.map(c => c.id),
          description: `Admin initiated payout for ${payoutPartner.partnerName}`
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create payout");
      }
      
      toast.success(`Payout created for ${payoutPartner.partnerName}`);
      
      // Refresh the data
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create payout");
      console.error(error);
    } finally {
      setProcessingPartnerIds((prev) => prev.filter(id => id !== payoutPartner.partnerId));
      setPayoutPartner(null);
    }
  };
  
  // Pagination for partner table
  const { pagination: partnerPagination, setPagination: setPartnerPagination } = usePagination();
  
  // Table for partners with pending commissions
  const partnerTable = useTable({
    data: groupedCommissions,
    columns: [
      {
        header: "Partner",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.partnerName}</span>
            <span className="text-xs text-neutral-500">{row.original.partnerEmail}</span>
          </div>
        ),
      },
      {
        header: "Pending Commissions",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.totalCommissions}</span>
        ),
      },
      {
        header: "Total Earnings",
        cell: ({ row }) => (
          <span className="font-medium">{currencyFormatter(row.original.totalEarnings / 100)}</span>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="h-8 px-2 py-0 text-sm"
              onClick={() => setSelectedPartner(
                selectedPartner === row.original.partnerId ? null : row.original.partnerId
              )}
            >
              {selectedPartner === row.original.partnerId ? "Hide Details" : "View Details"}
            </Button>
            <Button
              variant="primary"
              className="h-8 px-2 py-0 text-sm"
              onClick={() => handleCreatePayout(row.original)}
              loading={processingPartnerIds.includes(row.original.partnerId)}
              disabled={processingPartnerIds.includes(row.original.partnerId)}
            >
              Create Payout
            </Button>
          </div>
        ),
      },
    ],
    pagination: partnerPagination,
    onPaginationChange: setPartnerPagination,
    resourceName: () => "partner",
    loading: isLoading,
    error: error ? "Failed to load pending commissions" : undefined,
    rowCount: groupedCommissions.length,
  });
  
  // Pagination for commissions table when a partner is selected
  const { pagination: commissionPagination, setPagination: setCommissionPagination } = usePagination();
  
  // Table for selected partner's commissions
  const selectedPartnerCommissions = selectedPartner 
    ? groupedCommissions.find(p => p.partnerId === selectedPartner)?.commissions || []
    : [];
  
  const commissionTable = useTable({
    data: selectedPartnerCommissions,
    columns: [
      {
        header: "Date",
        accessorKey: "createdAt",
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
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="h-8 px-2 py-0 text-sm"
              onClick={() => handleCommissionStatusChange(row.original.id, CommissionStatus.processed)}
              loading={processingCommissionIds.includes(row.original.id)}
              disabled={
                processingCommissionIds.includes(row.original.id) ||
                row.original.status !== CommissionStatus.pending
              }
            >
              <Check className="mr-1 h-4 w-4" />
              Mark Processed
            </Button>
            <Select 
              value=""
              onChange={(value) => {
                if (value) {
                  handleCommissionStatusChange(row.original.id, value as CommissionStatus);
                }
              }}
              disabled={processingCommissionIds.includes(row.original.id)}
              placeholder="Change status..."
              className="w-32"
              options={[
                { value: CommissionStatus.duplicate, label: "Duplicate" },
                { value: CommissionStatus.fraud, label: "Fraud" },
                { value: CommissionStatus.canceled, label: "Canceled" },
              ]}
            />
          </div>
        ),
      },
    ],
    pagination: commissionPagination,
    onPaginationChange: setCommissionPagination,
    resourceName: () => "commission",
    loading: isLoading,
    rowCount: selectedPartnerCommissions.length,
  });
  
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-500">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
        <h3 className="font-medium">Error loading pending commissions</h3>
        <p className="text-sm">{error instanceof Error ? error.message : "An error occurred"}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Pending Commissions</h2>
        <Button
          variant="secondary"
          onClick={() => mutate()}
        >
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <AnalyticsLoadingSpinner />
        </div>
      ) : groupedCommissions.length > 0 ? (
        <>
          <Table {...partnerTable} />
          
          {selectedPartner && (
            <div className="mt-6 space-y-4">
              <h3 className="text-md font-medium">
                Commission Details for {
                  groupedCommissions.find(p => p.partnerId === selectedPartner)?.partnerName
                }
              </h3>
              <Table {...commissionTable} />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
          <CircleCheck className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
          <h3 className="font-medium text-neutral-600">No pending commissions</h3>
          <p className="text-sm text-neutral-500">
            All commissions have been processed or there are no commissions yet
          </p>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      <Dialog 
        open={createPayoutDialog.open} 
        setOpen={createPayoutDialog.setOpen}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Create Payout</Dialog.Title>
            <Dialog.Description>
              This will create a payout for all pending commissions for this partner.
            </Dialog.Description>
          </Dialog.Header>
          
          {payoutPartner && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-neutral-200 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm text-neutral-500">Partner:</div>
                  <div className="font-medium">{payoutPartner.partnerName}</div>
                  
                  <div className="text-sm text-neutral-500">Commissions:</div>
                  <div className="font-medium">{payoutPartner.totalCommissions}</div>
                  
                  <div className="text-sm text-neutral-500">Total Earnings:</div>
                  <div className="font-medium">{currencyFormatter(payoutPartner.totalEarnings / 100)}</div>
                </div>
              </div>
              
              <div className="text-sm text-neutral-500">
                This will mark all commissions as processed and create a pending payout
                that can be fulfilled through Stripe.
              </div>
            </div>
          )}
          
          <Dialog.Footer>
            <Dialog.Cancel>Cancel</Dialog.Cancel>
            <Dialog.Action
              onClick={processPartnerPayout}
              className="bg-primary hover:bg-primary/90"
            >
              Create Payout
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  );
} 