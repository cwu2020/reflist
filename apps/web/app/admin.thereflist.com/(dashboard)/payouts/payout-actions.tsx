"use client";

import { useState } from "react";
import { Button, StatusBadge } from "@dub/ui";
import { toast } from "sonner";
import { PayoutStatus } from "@dub/prisma/client";
import { PayoutStatusBadges } from "@/ui/partners/payout-status-badges";
import { CircleCheck } from "@dub/ui/icons";
import { Loader } from "lucide-react"; 

// Simple dropdown component for selecting payout status
function StatusSelect({ 
  value,
  onChange,
  disabled
}: { 
  value: PayoutStatus; 
  onChange: (value: PayoutStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PayoutStatus)}
      disabled={disabled}
      className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
    >
      <option value={PayoutStatus.pending}>Pending</option>
      <option value={PayoutStatus.processing}>Processing</option>
      <option value={PayoutStatus.completed}>Completed</option>
      <option value={PayoutStatus.failed}>Failed</option>
      <option value={PayoutStatus.canceled}>Canceled</option>
    </select>
  );
}

interface PayoutActionsProps {
  payoutId: string;
  currentStatus: PayoutStatus;
  onStatusUpdate?: () => void;
}

export function PayoutActions({ payoutId, currentStatus, onStatusUpdate }: PayoutActionsProps) {
  const [status, setStatus] = useState<PayoutStatus>(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStripeInput, setShowStripeInput] = useState(false);
  const [stripeTransferId, setStripeTransferId] = useState("");
  
  // Handle changing payout status
  const handleUpdateStatus = async () => {
    try {
      setIsUpdating(true);
      
      // If completing the payout with Stripe, require transfer ID
      if (status === PayoutStatus.completed && !stripeTransferId && showStripeInput) {
        toast.error("Please enter a Stripe transfer ID");
        return;
      }
      
      const response = await fetch(`/api/admin/payouts/${payoutId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status,
          ...(stripeTransferId && { stripeTransferId })
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update payout status");
      }
      
      toast.success(`Payout status updated to ${status}`);
      
      // Call the onStatusUpdate callback if provided
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <StatusSelect 
          value={status} 
          onChange={(newStatus) => {
            setStatus(newStatus);
            setShowStripeInput(newStatus === PayoutStatus.completed);
          }}
          disabled={isUpdating}
        />
        
        <Button
          variant="secondary"
          onClick={handleUpdateStatus}
          disabled={isUpdating || status === currentStatus}
          className="h-8 px-2 py-0 text-sm"
        >
          {isUpdating ? (
            <>
              <Loader className="mr-1 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Status"
          )}
        </Button>
      </div>
      
      {showStripeInput && (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            value={stripeTransferId}
            onChange={(e) => setStripeTransferId(e.target.value)}
            placeholder="Stripe Transfer ID (optional)"
            disabled={isUpdating}
            className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
          />
        </div>
      )}
    </div>
  );
} 