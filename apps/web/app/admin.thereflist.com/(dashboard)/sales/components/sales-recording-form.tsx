"use client";

import { useState } from "react";
import { Button, Input } from "@dub/ui";

interface SalesRecordingFormProps {
  linkId: string;
  onSubmit: (data: SaleFormData) => void;
  isSubmitting: boolean;
}

export interface SaleFormData {
  amount: number;
  currency: string;
  paymentProcessor: string;
  invoiceId?: string;
  eventName: string;
  notes?: string;
}

const PAYMENT_PROCESSORS = [
  { value: "stripe", label: "Stripe" },
  { value: "paypal", label: "PayPal" },
  { value: "custom", label: "Custom/Other" },
];

const CURRENCIES = [
  { value: "usd", label: "USD ($)" },
  { value: "eur", label: "EUR (€)" },
  { value: "gbp", label: "GBP (£)" },
  { value: "cad", label: "CAD ($)" },
  { value: "aud", label: "AUD ($)" },
];

export function SalesRecordingForm({ 
  linkId,
  onSubmit,
  isSubmitting 
}: SalesRecordingFormProps) {
  const [formData, setFormData] = useState<SaleFormData>({
    amount: 0,
    currency: "usd",
    paymentProcessor: "custom",
    eventName: "Manual Sale",
    invoiceId: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) * 100 : value, // Convert to cents for amount
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="amount" className="mb-2 block text-sm font-medium text-neutral-700">
            Sale Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-neutral-500 sm:text-sm">$</span>
            </div>
            <Input
              id="amount"
              name="amount"
              type="number"
              className="pl-7"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              onChange={handleChange}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">Enter the amount in dollars (will be converted to cents)</p>
        </div>

        <div>
          <label htmlFor="currency" className="mb-2 block text-sm font-medium text-neutral-700">
            Currency <span className="text-red-500">*</span>
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            required
            className="block w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {CURRENCIES.map(currency => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="paymentProcessor" className="mb-2 block text-sm font-medium text-neutral-700">
            Payment Processor <span className="text-red-500">*</span>
          </label>
          <select
            id="paymentProcessor"
            name="paymentProcessor"
            value={formData.paymentProcessor}
            onChange={handleChange}
            required
            className="block w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {PAYMENT_PROCESSORS.map(processor => (
              <option key={processor.value} value={processor.value}>
                {processor.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="invoiceId" className="mb-2 block text-sm font-medium text-neutral-700">
            Invoice ID
          </label>
          <Input
            id="invoiceId"
            name="invoiceId"
            placeholder="INV-12345"
            value={formData.invoiceId}
            onChange={handleChange}
          />
          <p className="mt-1 text-xs text-neutral-500">Optional reference number or invoice ID</p>
        </div>
      </div>

      <div>
        <label htmlFor="eventName" className="mb-2 block text-sm font-medium text-neutral-700">
          Event Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="eventName"
          name="eventName"
          placeholder="Manual Sale"
          value={formData.eventName}
          onChange={handleChange}
          required
        />
        <p className="mt-1 text-xs text-neutral-500">A name to identify this sale event (e.g., &quot;Product Purchase&quot;, &quot;Subscription&quot;)</p>
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block text-sm font-medium text-neutral-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          placeholder="Additional information about this sale..."
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="block w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1 text-xs text-neutral-500">Optional internal notes (not visible to the user)</p>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Recording Sale..." : "Record Sale"}
        </Button>
      </div>
    </form>
  );
} 