"use client";

import { useState, useMemo, useEffect } from "react";
import { Button, Input, Sliders } from "@dub/ui";

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
  customerId?: string;
  commissionAmount?: number;
  commissionSplitPercentage?: number;
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
    customerId: "",
    commissionAmount: 0,
    commissionSplitPercentage: 50, // Default to 50%
  });

  // Calculate partner earnings based on commission amount and split percentage
  const calculatedEarnings = useMemo(() => {
    if (!formData.commissionAmount || formData.commissionAmount <= 0) {
      return 0;
    }
    
    const splitPercentage = formData.commissionSplitPercentage || 50;
    return Math.floor(formData.commissionAmount * (splitPercentage / 100));
  }, [formData.commissionAmount, formData.commissionSplitPercentage]);

  // Validate that commission amount doesn't exceed sale amount
  useEffect(() => {
    if (formData.commissionAmount && formData.commissionAmount > formData.amount && formData.amount > 0) {
      setFormData(prev => ({
        ...prev,
        commissionAmount: formData.amount
      }));
    }
  }, [formData.amount, formData.commissionAmount]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === "amount" || name === "commissionAmount" 
        ? parseFloat(value) * 100 // Convert to cents for monetary amounts
        : value,
    }));
  };

  const handleSliderChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      commissionSplitPercentage: value,
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
          <p className="mt-1 text-xs text-neutral-500">Enter the total sale amount in dollars (will be converted to cents)</p>
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

      {/* New Commission Amount Field */}
      <div className="rounded-md bg-blue-50 p-4">
        <h3 className="mb-2 text-sm font-medium text-blue-800">Commission Override Settings</h3>
        <p className="mb-3 text-xs text-blue-700">
          Use these fields to manually control the commission calculation. If left at zero, the system will use the default calculation logic.
        </p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="commissionAmount" className="mb-2 block text-sm font-medium text-neutral-700">
              Commission Amount
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-neutral-500 sm:text-sm">$</span>
              </div>
              <Input
                id="commissionAmount"
                name="commissionAmount"
                type="number"
                className="pl-7"
                placeholder="0.00"
                min="0"
                max={formData.amount > 0 ? formData.amount / 100 : undefined}
                step="0.01"
                onChange={handleChange}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              The commission amount that Reflist received from ShopMy (cannot exceed the sale amount)
            </p>
          </div>

          <div>
            <label htmlFor="commissionSplitPercentage" className="mb-2 block text-sm font-medium text-neutral-700">
              Commission Split Percentage: {formData.commissionSplitPercentage || 50}%
            </label>
            <input
              type="range"
              id="commissionSplitPercentage"
              name="commissionSplitPercentage"
              min="0"
              max="100"
              step="1"
              value={formData.commissionSplitPercentage || 50}
              onChange={(e) => handleSliderChange(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Percentage of the commission that goes to the partner (the rest is kept by Reflist)
            </p>
          </div>

          <div className="rounded-md bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-neutral-700">Partner Earnings:</span>
              <span className="font-bold text-green-600">
                ${(calculatedEarnings / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>Reflist Keeps:</span>
              <span>
                ${(formData.commissionAmount && formData.commissionAmount > 0 
                  ? (formData.commissionAmount - calculatedEarnings) / 100 
                  : 0).toFixed(2)}
              </span>
            </div>
          </div>
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

      <div>
        <label htmlFor="customerId" className="mb-2 block text-sm font-medium text-neutral-700">
          Customer ID
        </label>
        <Input
          id="customerId"
          name="customerId"
          placeholder="cus_..."
          value={formData.customerId}
          onChange={handleChange}
        />
        <p className="mt-1 text-xs text-neutral-500">Optional: Link this sale to an existing customer. If left blank, a new customer will be created.</p>
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