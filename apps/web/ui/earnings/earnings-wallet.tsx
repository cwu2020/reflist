"use client";

import { Button, LoadingSpinner } from "@dub/ui";
import { CircleDollar } from "@dub/ui/icons";
import { currencyFormatter } from "@dub/utils";
import { useState } from "react";
import { WithdrawModal } from ".";

export function EarningsWallet() {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  // Mock data - will be replaced with actual API calls
  const isLoading = false;
  const availableBalance = 120000; // $1,200.00
  const pendingEarnings = 50000; // $500.00
  const monthlyEarnings = 80000; // $800.00

  return (
    <div className="w-full rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h2 className="text-lg font-medium text-neutral-900">Earnings Balance</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Track your earnings and withdraw funds
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowWithdrawModal(true)}
          disabled={availableBalance <= 0 || isLoading}
          className="flex items-center space-x-2"
          icon={<CircleDollar className="h-4 w-4" />}
          text="Withdraw"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Available Balance */}
        <BalanceCard
          title="Available Balance"
          amount={availableBalance}
          description="Ready to withdraw"
          isLoading={isLoading}
        />

        {/* Pending Earnings */}
        <BalanceCard
          title="Pending Earnings"
          amount={pendingEarnings}
          description="Processing"
          isLoading={isLoading}
        />

        {/* Monthly Earnings */}
        <BalanceCard
          title="This Month"
          amount={monthlyEarnings}
          description="Earnings in current month"
          isLoading={isLoading}
        />
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <WithdrawModal
          availableBalance={availableBalance}
          setShowWithdrawModal={setShowWithdrawModal}
        />
      )}
    </div>
  );
}

function BalanceCard({
  title,
  amount,
  description,
  isLoading,
}: {
  title: string;
  amount: number;
  description: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
      <div className="mt-2">
        {isLoading ? (
          <div className="flex h-7 items-center">
            <LoadingSpinner />
          </div>
        ) : (
          <p className="text-2xl font-semibold tracking-tight text-neutral-900">
            {currencyFormatter(amount / 100)}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </div>
  );
} 