"use client";

import { Button, Modal } from "@dub/ui";
import { currencyFormatter } from "@dub/utils";
import { useParams } from "next/navigation";
import { useState } from "react";

export function WithdrawModal({
  availableBalance,
  setShowWithdrawModal,
}: {
  availableBalance: number;
  setShowWithdrawModal: (show: boolean) => void;
}) {
  const { slug } = useParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleWithdraw = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(false);
      
      // Call the real withdraw API endpoint
      const response = await fetch(`/api/workspace/${slug}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: availableBalance,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to process withdrawal");
      }
      
      // Show success message and close modal after a short delay
      setSuccess(true);
      setTimeout(() => {
        setShowWithdrawModal(false);
      }, 1500);
    } catch (err) {
      console.error("Error withdrawing funds:", err);
      setError(err instanceof Error ? err.message : "Failed to process withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal showModal={true} setShowModal={setShowWithdrawModal}>
      <div className="flex flex-col items-center justify-center space-y-3 border-b border-neutral-200 px-4 py-8 sm:px-10">
        <h3 className="text-xl font-medium">Withdraw Earnings</h3>
        <p className="text-center text-sm text-neutral-500">
          You are about to withdraw your available balance to your connected account.
        </p>
      </div>

      <div className="flex flex-col space-y-6 p-4 pt-8 sm:px-10">
        <div>
          <h4 className="text-sm font-medium text-neutral-700">Available Balance</h4>
          <p className="mt-2 text-2xl font-semibold">
            {currencyFormatter(availableBalance / 100)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Withdrawals typically take 1-3 business days to process
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-2 text-sm text-green-500">
              Withdrawal request submitted successfully
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => setShowWithdrawModal(false)}
            className="w-full sm:w-auto"
            disabled={isSubmitting || success}
            text="Cancel"
          />
          <Button
            variant="primary"
            onClick={handleWithdraw}
            loading={isSubmitting}
            disabled={success}
            className="w-full sm:w-auto"
            text="Confirm Withdrawal"
          />
        </div>
      </div>
    </Modal>
  );
} 