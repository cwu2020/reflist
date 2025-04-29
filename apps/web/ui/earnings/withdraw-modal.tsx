"use client";

import { Button, Modal } from "@dub/ui";
import { currencyFormatter } from "@dub/utils";
import { useState } from "react";

export function WithdrawModal({
  availableBalance,
  setShowWithdrawModal,
}: {
  availableBalance: number;
  setShowWithdrawModal: (show: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWithdraw = async () => {
    try {
      setIsSubmitting(true);
      // Mock API call - will be replaced with actual withdrawal API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowWithdrawModal(false);
      // Show success toast or message
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      // Show error toast or message
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
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => setShowWithdrawModal(false)}
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            text="Cancel"
          />
          <Button
            variant="primary"
            onClick={handleWithdraw}
            loading={isSubmitting}
            className="w-full sm:w-auto"
            text="Confirm Withdrawal"
          />
        </div>
      </div>
    </Modal>
  );
} 