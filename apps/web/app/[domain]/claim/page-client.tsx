"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@dub/ui";
import PhoneVerificationForm from "@/ui/verification/phone-verification-form";

export default function PhoneVerificationPageClient() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [unclaimedCommissions, setUnclaimedCommissions] = useState<any[]>([]);
  const [verifiedPhone, setVerifiedPhone] = useState("");

  const handleVerificationSuccess = (phoneNumber: string, commissions: any[]) => {
    setVerified(true);
    setVerifiedPhone(phoneNumber);
    setUnclaimedCommissions(commissions);
  };

  const handleSignUp = () => {
    // Navigate to sign up page with phone number pre-filled
    router.push(`/signin?phoneNumber=${encodeURIComponent(verifiedPhone)}&claim=true`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        {!verified ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Verify Your Phone Number</h2>
              <p className="text-gray-500 text-sm mt-1">
                Enter your phone number to check for any commissions you may have earned.
              </p>
            </div>
            <div className="mb-4">
              <PhoneVerificationForm onVerificationSuccess={handleVerificationSuccess} />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/signin" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Verification Successful</h2>
              <p className="text-gray-500 text-sm mt-1">
                {unclaimedCommissions.length > 0
                  ? `You have ${unclaimedCommissions.length} unclaimed commission${
                      unclaimedCommissions.length === 1 ? "" : "s"
                    }!`
                  : "No unclaimed commissions found for this phone number."}
              </p>
            </div>
            <div className="mb-6">
              {unclaimedCommissions.length > 0 ? (
                <div className="space-y-4">
                  <p>Total unclaimed amount: {calculateTotalAmount(unclaimedCommissions)}</p>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Commission Details:</h3>
                    <ul className="space-y-2">
                      {unclaimedCommissions.map((commission, index) => (
                        <li key={index} className="text-sm">
                          <span className="font-medium">{commission.linkTitle}</span>:{" "}
                          {formatAmount(commission.amount, commission.currency)} (
                          {new Date(commission.date).toLocaleDateString()})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p>
                  We couldn't find any unclaimed commissions associated with this phone number. 
                  If you believe this is an error, please contact support.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {unclaimedCommissions.length > 0 && (
                <Button onClick={handleSignUp} className="w-full">
                  Create an Account to Claim
                </Button>
              )}
              <div className="text-center text-sm text-gray-500">
                <p>
                  Already have an account?{" "}
                  <Link href="/signin" className="text-blue-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format currency amounts
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount / 100); // Assuming amount is stored in cents
}

// Helper function to calculate total commission amount
function calculateTotalAmount(commissions: any[]): string {
  // Group commissions by currency
  const byCurrency = commissions.reduce((acc, commission) => {
    const currency = commission.currency || "USD";
    if (!acc[currency]) {
      acc[currency] = 0;
    }
    acc[currency] += Number(commission.amount);
    return acc;
  }, {} as Record<string, number>);

  // Format each currency group
  return Object.entries(byCurrency)
    .map(([currency, amount]) => formatAmount(amount as number, currency))
    .join(", ");
} 