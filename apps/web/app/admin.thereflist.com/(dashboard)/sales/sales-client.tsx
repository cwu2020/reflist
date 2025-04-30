"use client";

import { useState } from "react";
import { MaxWidthWrapper } from "@dub/ui";
import { LinkSearchInput, SalesRecordingForm, RecentSalesTable, type SaleFormData } from "./components";
import { toast } from "sonner";
import { mutate } from "swr";

export default function SalesPageClient() {
  const [selectedLink, setSelectedLink] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // When a link is selected from the search
  const handleLinkSelect = (link: any) => {
    setSelectedLink(link);
    setShowSuccess(false);
  };

  // Handle form submission
  const handleSubmit = async (formData: SaleFormData) => {
    setIsSubmitting(true);
    setShowSuccess(false);
    
    try {
      const response = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkId: selectedLink.id,
          amount: formData.amount,
          currency: formData.currency,
          paymentProcessor: formData.paymentProcessor,
          eventName: formData.eventName,
          invoiceId: formData.invoiceId,
          notes: formData.notes,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record sale');
      }
      
      // Success! Show success message and reset form
      toast.success("Sale recorded successfully");
      setShowSuccess(true);
      setSelectedLink(null);
      
      // Revalidate the sales list
      mutate('/api/admin/sales');
    } catch (error) {
      console.error("Error recording sale:", error);
      toast.error("Failed to record sale: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Record Manual Sales</h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-medium">Step 1: Find link</h2>
          <p className="mb-4 text-sm text-neutral-600">
            Search for a link by URL, ID, or key to record a manual sale.
          </p>
          <LinkSearchInput onSelect={handleLinkSelect} />
        </div>
      </div>

      {selectedLink && (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="p-6">
            <h2 className="mb-4 text-lg font-medium">Step 2: Record sale</h2>
            <div className="mb-4 rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Recording sale for link: <strong>{selectedLink.url}</strong>
              </p>
              <p className="text-sm text-blue-800">
                Owner: <strong>{selectedLink.user?.email || "Unknown"}</strong>
              </p>
            </div>
            <SalesRecordingForm 
              linkId={selectedLink.id}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-green-800">
          <p className="font-medium">Sale recorded successfully!</p>
          <p className="text-sm">The sale has been recorded and will appear in the user&apos;s dashboard.</p>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-medium">Recent Manual Sales</h2>
          <RecentSalesTable />
        </div>
      </div>
    </div>
  );
} 