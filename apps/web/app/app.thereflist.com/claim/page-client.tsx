"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@dub/ui";
import PhoneVerificationForm from "@/ui/verification/phone-verification-form";
import { useSession, signIn } from "next-auth/react";

// Key for storing verification data in localStorage
const VERIFICATION_STORAGE_KEY = "reflist_phone_verification_data";
// Set verification data to expire after 1 hour (in milliseconds)
const VERIFICATION_EXPIRY_MS = 60 * 60 * 1000;

// Format a currency amount (amount in cents)
function formatAmount(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount / 100);
}

export default function PhoneVerificationPageClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [verified, setVerified] = useState(false);
  const [unclaimedCommissions, setUnclaimedCommissions] = useState<any[]>([]);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationExpired, setVerificationExpired] = useState(false);
  const [claimedCommissions, setClaimedCommissions] = useState<any[]>([]);
  const [readyToClaim, setReadyToClaim] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Remove auto-claim functionality from the useEffect
  useEffect(() => {
    // No longer auto-claim on login - just prepare to display claim button
    if (status === "authenticated" && verified && !alreadyClaimed && 
        session?.user && unclaimedCommissions.length > 0) {
      setReadyToClaim(true);
    }
  }, [status, verified, alreadyClaimed, session, unclaimedCommissions]);

  // When component mounts, check if there's saved verification data
  useEffect(() => {
    const savedData = localStorage.getItem(VERIFICATION_STORAGE_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        
        // Check if verification data has expired
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          console.log("Verification data expired");
          localStorage.removeItem(VERIFICATION_STORAGE_KEY);
          setVerificationExpired(true);
          return;
        }
        
        if (data.verified && data.verifiedPhone && data.unclaimedCommissions) {
          setVerified(data.verified);
          setVerifiedPhone(data.verifiedPhone);
          setUnclaimedCommissions(data.unclaimedCommissions);
        }
      } catch (error) {
        console.error("Error parsing saved verification data:", error);
        localStorage.removeItem(VERIFICATION_STORAGE_KEY);
      }
    }
  }, []);

  // Add an effect to handle authentication status changes
  useEffect(() => {
    if (status === "unauthenticated" && verified && !alreadyClaimed && unclaimedCommissions.length > 0 && readyToClaim) {
      console.log("Authentication lost, disabling claim button and showing sign-in options");
      setReadyToClaim(false);
    } else if (status === "authenticated" && verified && !alreadyClaimed && unclaimedCommissions.length > 0) {
      console.log("User authenticated, enabling claim button");
      setReadyToClaim(true);
    }
  }, [status, verified, alreadyClaimed, unclaimedCommissions.length]);

  const handleVerificationSuccess = (
    phoneNumber: string,
    commissions: any[],
    alreadyClaimed: boolean = false,
    claimedCommissions: any[] = []
  ) => {
    setVerified(true);
    setVerifiedPhone(phoneNumber);
    setUnclaimedCommissions(commissions);
    setClaimedCommissions(claimedCommissions || []);
    setAlreadyClaimed(alreadyClaimed);

    if (commissions.length > 0) {
      if (status === "authenticated") {
        setReadyToClaim(true);
      } else {
        setReadyToClaim(false);
        // Store verification data in localStorage
        localStorage.setItem(
          `verification-data-${phoneNumber}`,
          JSON.stringify({
            verified: true,
            phoneNumber,
            unclaimedCommissions: commissions,
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
          })
        );
        console.log("User needs to sign in before claiming");
      }
    }
  };

  // This function is now redundant since we're using explicit claims
  const claimAfterLogin = async () => {
    console.log("Setting readyToClaim to true for the claim button");
    setReadyToClaim(true);
  };

  // Function to handle the claim button press
  const handleClaim = async () => {
    if (!verifiedPhone) {
      console.error("Missing verified phone number for claiming");
      return;
    }

    if (status !== "authenticated") {
      console.log("User is not authenticated, redirecting to sign in");
      alert("Your session has expired. Please sign in again to claim your commissions.");
      
      // Save verification data
      localStorage.setItem(
        `verification-data-${verifiedPhone}`,
        JSON.stringify({
          verified: true,
          unclaimedCommissions,
          phoneNumber: verifiedPhone,
          expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
        })
      );
      
      // Redirect to sign in
      signIn();
      return;
    }

    setIsProcessing(true);
    
    try {
      // Use the verify-code-only endpoint with the special claim code
      console.log(`Sending claim request for phone: ${verifiedPhone}`);
      const response = await fetch("/api/phone-verification/verify-code-only", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: verifiedPhone,
          code: "CLAIM_COMMISSIONS",
          doClaim: true
        }),
      });

      if (response.status === 401) {
        console.error("Authentication error - session expired");
        alert("Your session has expired. Please sign in again to claim your commissions.");
        
        // Save verification data
        localStorage.setItem(
          `verification-data-${verifiedPhone}`,
          JSON.stringify({
            verified: true,
            unclaimedCommissions,
            phoneNumber: verifiedPhone,
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
          })
        );
        
        // Redirect to sign in
        signIn();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error claiming commissions:", errorData);
        alert(`Error claiming commissions: ${errorData.error || "Unknown error"}`);
        setIsProcessing(false);
        return;
      }

      const data = await response.json();
      console.log("Claim response:", data);

      if (data.data.claimedCount && data.data.claimedCount > 0) {
        // Show success message
        alert(`Successfully claimed ${data.data.claimedCount} commissions!`);
        
        // Clean up localStorage
        localStorage.removeItem(`verification-data-${verifiedPhone}`);
        
        // Update state
        setAlreadyClaimed(true);
        setReadyToClaim(false);
        if (data.data.claimedCommissions) {
          setClaimedCommissions(data.data.claimedCommissions);
        }
        setUnclaimedCommissions([]);
        
        // Get workspaces to find a valid slug for redirection
        fetch('/api/workspaces')
          .then(res => res.json())
          .then(workspaceData => {
            // Show success message and redirect to dashboard
            setTimeout(() => {
              if (workspaceData && workspaceData.length > 0 && workspaceData[0].slug) {
                console.log(`Redirecting to workspace: /${workspaceData[0].slug}`);
                router.push(`/${workspaceData[0].slug}/earnings`);
              } else {
                // Fallback to default dashboard if no workspace found
                console.log("No workspace found, redirecting to home");
                router.push('/');
              }
            }, 1500);
          })
          .catch(err => {
            console.error("Error fetching workspaces:", err);
            setTimeout(() => router.push('/'), 1500);
          });
      } else {
        console.log("No commissions were claimed");
        alert("No commissions were claimed. Please try again later.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error claiming commissions:", error);
      alert(`Error claiming commissions: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsProcessing(false);
    }
  };

  // Function to verify the code, now with a fallback to verify-code-only endpoint
  const verifyCode = async () => {
    if (!phoneNumber || !verificationCode) {
      console.error("Missing phone number or verification code");
      return;
    }

    setIsVerifying(true);
    
    try {
      // First try the regular verification endpoint
      let response = await fetch("/api/phone-verification/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          code: verificationCode,
        }),
      });

      // If we get an auth error, fall back to the code-only verification endpoint
      if (response.status === 401) {
        console.log("Auth error from main endpoint, trying fallback endpoint");
        
        response = await fetch("/api/phone-verification/verify-code-only", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
            code: verificationCode,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Verification failed:", errorData);
        setErrorMessage(errorData.error || "Verification failed");
        setIsVerifying(false);
        return;
      }

      const data = await response.json();
      console.log("Verification result:", data);

      if (data.success) {
        // Save verified code to localStorage
        localStorage.setItem(`verification-code-${phoneNumber}`, verificationCode);
        
        // Extract data from the response
        const { verified, alreadyClaimed, unclaimedCommissions = [], claimedCommissions = [] } = data.data || {};
        
        // Call the parent handler with all the relevant data
        handleVerificationSuccess(phoneNumber, unclaimedCommissions, alreadyClaimed, claimedCommissions);
        
        setErrorMessage("");
      } else {
        setErrorMessage(data.error || "Verification failed");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      setErrorMessage("Error verifying code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignUp = () => {
    // Navigate to sign up page with phone number pre-filled
    router.push(`/register?phoneNumber=${encodeURIComponent(verifiedPhone)}&claim=true`);
  };

  const handleSignIn = () => {
    // Navigate to sign in page, the verification data is already saved in localStorage
    router.push(`/signin?next=${encodeURIComponent('/claim')}`);
  };

  const calculateTotalAmount = (commissions) => {
    if (!commissions || commissions.length === 0) return "$0.00";
    
    // Group by currency
    const byCurrency = commissions.reduce((acc, commission) => {
      const currency = commission.currency || "USD";
      const amount = commission.earnings || 0;
      
      if (!acc[currency]) acc[currency] = 0;
      acc[currency] += amount;
      
      return acc;
    }, {});
    
    // Format each currency group
    return Object.entries(byCurrency)
      .map(([currency, amount]) => formatAmount(Number(amount), currency))
      .join(" + ");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {!verified ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Verify Your Phone Number</h2>
              <p className="text-gray-500 text-sm mt-1">
                Enter your phone number to check if you have any unclaimed commissions.
              </p>
              {verificationExpired && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                  Your previous verification has expired. Please verify your phone number again.
                </div>
              )}
            </div>
            <PhoneVerificationForm onVerificationSuccess={handleVerificationSuccess} />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Verification Successful</h2>
              {alreadyClaimed ? (
                <>
                  <p className="text-green-600 font-medium mt-2">
                    Your commissions have been successfully claimed to your account!
                  </p>
                  {claimedCommissions.length > 0 && (
                    <div className="mt-3 bg-green-50 p-3 rounded-md border border-green-200">
                      <p className="text-green-800 font-medium">
                        You claimed {claimedCommissions.length} commission{claimedCommissions.length !== 1 ? 's' : ''} worth {calculateTotalAmount(claimedCommissions)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm mt-1">
                  {unclaimedCommissions.length > 0
                    ? `You have ${unclaimedCommissions.length} unclaimed commission${
                        unclaimedCommissions.length === 1 ? "" : "s"
                      }!`
                    : "No unclaimed commissions found for this phone number."}
                </p>
              )}
            </div>
            <div className="mb-6">
              {!alreadyClaimed && unclaimedCommissions.length > 0 ? (
                <div className="space-y-4">
                  <p>Total unclaimed amount: {calculateTotalAmount(unclaimedCommissions)}</p>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <h3 className="text-sm font-semibold mb-2">Commission Details:</h3>
                    <ul className="space-y-2">
                      {unclaimedCommissions.map((commission, index) => (
                        <li key={index} className="text-sm">
                          <span className="font-medium">{commission.linkTitle}</span>:{" "}
                          {formatAmount(commission.earnings, commission.currency)} (
                          {new Date(commission.date).toLocaleDateString()})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                !alreadyClaimed && (
                  <p>
                    We couldn't find any unclaimed commissions associated with this phone number. 
                    If you believe this is an error, please contact support.
                  </p>
                )
              )}
              
              {alreadyClaimed && (
                <div className="my-4">
                  <p className="text-gray-600">
                    You'll be redirected to your dashboard in a moment...
                  </p>
                </div>
              )}
              
              {isProcessing && (
                <div className="my-4">
                  <p className="text-blue-600">
                    Processing your commissions...
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {!alreadyClaimed && unclaimedCommissions.length > 0 && (
                <>
                  {status === "authenticated" && readyToClaim ? (
                    // Claim button for logged-in users
                    <Button 
                      onClick={handleClaim} 
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : `Claim ${calculateTotalAmount(unclaimedCommissions)} Now`}
                    </Button>
                  ) : (
                    // Sign up/sign in options for non-logged in users
                    <>
                      <Button onClick={handleSignUp} className="w-full">
                        Create an Account to Claim
                      </Button>
                      <Button onClick={handleSignIn} variant="outline" className="w-full">
                        Sign In to Existing Account
                      </Button>
                    </>
                  )}
                </>
              )}
              {!alreadyClaimed && unclaimedCommissions.length === 0 && (
                <div className="text-center text-sm text-gray-500">
                  <p>
                    <Link href="/" className="text-blue-600 hover:underline">
                      Return to Home
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 