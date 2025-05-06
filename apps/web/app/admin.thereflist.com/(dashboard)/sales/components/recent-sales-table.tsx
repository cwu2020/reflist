"use client";

import { useState } from "react";
import { Table, StatusBadge, Modal, Button } from "@dub/ui";
import { fetcher, formatDateTime } from "@dub/utils";
import useSWR from "swr";
import { toast } from "sonner";

interface SaleData {
  id: string;
  linkId: string;
  linkKey: string;
  linkUrl: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "paid" | "refunded" | "duplicate" | "fraud" | "canceled";
  createdAt: string;
  userId: string;
  userEmail: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  eventId: string;
  invoiceId: string | null;
}

export function RecentSalesTable() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleData | null>(null);
  
  // Fetch sales data from the API
  const { data, isLoading, error, mutate } = useSWR<{ sales: SaleData[] }>(
    `/api/admin/sales`,
    fetcher,
    {
      refreshInterval: 30000, // refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );
  
  const statusVariantMap = {
    pending: "pending" as const,
    processed: "new" as const,
    paid: "success" as const,
    refunded: "error" as const,
    duplicate: "neutral" as const,
    fraud: "error" as const,
    canceled: "neutral" as const
  };

  // Handle status change
  const handleStatusChange = async (saleId: string, newStatus: string) => {
    try {
      setUpdatingId(saleId);
      
      const response = await fetch(`/api/admin/sales/${saleId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }
      
      toast.success(`Changed sale status to ${newStatus}`);
      
      // Revalidate the data
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle delete confirmation
  const openDeleteConfirmation = (sale: SaleData) => {
    setSaleToDelete(sale);
    setShowDeleteConfirmation(true);
  };

  // Handle actual deletion
  const handleDelete = async () => {
    if (!saleToDelete) return;
    
    try {
      setDeletingId(saleToDelete.id);
      
      const response = await fetch(`/api/admin/commissions/${saleToDelete.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete commission");
      }
      
      toast.success(`Commission has been permanently deleted`);
      
      // Close the dialog
      setShowDeleteConfirmation(false);
      
      // Revalidate the data
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete commission");
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return <div className="text-center text-red-500">Error loading sales data</div>;
  }

  if (isLoading) {
    return <div className="text-center text-neutral-500">Loading sales data...</div>;
  }

  const sales = data?.sales || [];

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      <Modal 
        showModal={showDeleteConfirmation}
        setShowModal={setShowDeleteConfirmation}
      >
        <div className="space-y-2 border-b border-neutral-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium leading-none">Delete Commission</h3>
        </div>
        
        <div className="bg-neutral-50 p-4 sm:p-6">
          <p className="text-sm text-neutral-800">
            Are you sure you want to <span className="font-semibold text-red-600">permanently delete</span> this commission record?
          </p>
          
          {saleToDelete && (
            <div className="mt-4 rounded-md bg-neutral-100 p-3">
              <p className="text-sm">
                <span className="font-semibold">Amount:</span>{" "}
                {new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: saleToDelete.currency.toUpperCase() 
                }).format(saleToDelete.amount / 100)}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Link:</span> {saleToDelete.linkKey}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Date:</span> {formatDateTime(new Date(saleToDelete.createdAt))}
              </p>
            </div>
          )}
          
          <p className="mt-4 text-sm font-medium text-neutral-800">This action:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>Cannot be undone</li>
            <li>Will remove this sale from all reports and analytics</li>
            <li>Will update link statistics to remove this sale</li>
          </ul>
        </div>
        
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 p-4 sm:p-6">
          <Button
            text="Cancel"
            variant="secondary"
            onClick={() => setShowDeleteConfirmation(false)}
            className="h-8 w-fit px-3"
          />
          <Button
            text={deletingId === saleToDelete?.id ? "Deleting..." : "Delete Commission"}
            variant="danger"
            loading={deletingId === saleToDelete?.id}
            onClick={handleDelete}
            className="h-8 w-fit px-3"
          />
        </div>
      </Modal>

      {sales.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 p-8 text-center text-sm text-neutral-500">
          No manual sales have been recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Link</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-neutral-200 hover:bg-neutral-50"
                >
                  <td className="p-3 text-sm">{formatDateTime(new Date(sale.createdAt))}</td>
                  <td className="p-3">
                    <div className="max-w-[200px]">
                      <div className="font-medium">{sale.linkKey}</div>
                      <div className="truncate text-xs text-neutral-500">{sale.linkUrl}</div>
                    </div>
                  </td>
                  <td className="p-3 text-sm max-w-[150px] truncate">{sale.userEmail}</td>
                  <td className="p-3 text-sm">
                    {new Intl.NumberFormat('en-US', { 
                      style: 'currency', 
                      currency: sale.currency.toUpperCase() 
                    }).format(sale.amount / 100)}
                  </td>
                  <td className="p-3">
                    <StatusBadge variant={statusVariantMap[sale.status]}>
                      {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="p-3 text-right">
                    {updatingId === sale.id || deletingId === sale.id ? (
                      <span className="text-xs text-neutral-400">
                        {updatingId === sale.id ? "Updating..." : "Deleting..."}
                      </span>
                    ) : (
                      <>
                        {sale.status === "pending" && (
                          <>
                            <button 
                              className="ml-2 text-xs text-red-500 hover:text-red-800"
                              onClick={() => handleStatusChange(sale.id, "duplicate")}
                            >
                              Mark Duplicate
                            </button>
                            <button 
                              className="ml-2 text-xs text-red-500 hover:text-red-800"
                              onClick={() => handleStatusChange(sale.id, "fraud")}
                            >
                              Mark Fraud
                            </button>
                            <button 
                              className="ml-2 text-xs text-red-500 hover:text-red-800"
                              onClick={() => handleStatusChange(sale.id, "canceled")}
                            >
                              Mark Canceled
                            </button>
                          </>
                        )}
                        {(sale.status === "duplicate" || sale.status === "fraud" || sale.status === "canceled") && (
                          <>
                            <button 
                              className="mr-2 text-xs text-blue-500 hover:text-blue-800"
                              onClick={() => handleStatusChange(sale.id, "pending")}
                            >
                              Restore
                            </button>
                            <button 
                              className="text-xs text-red-500 hover:text-red-800"
                              onClick={() => openDeleteConfirmation(sale)}
                            >
                              Delete Permanently
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 