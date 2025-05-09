"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Wordmark } from "@dub/ui";
import PhoneVerificationForm from "@/ui/verification/phone-verification-form";
import { useSession, signIn } from "next-auth/react";
import { NewBackground } from "@/ui/shared/new-background";
import Toolbar from "@/ui/layout/toolbar/toolbar";

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
  const [phase, setPhase] = useState("VERIFY_PHONE");

  // Remove auto-claim functionality from the useEffect
  useEffect(() => {
    // If user is authenticated and we have verified unclaimed commissions, 
    // make the claim button ready but don't auto-claim
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
      
      // No auto-claiming - user must click the claim button manually
      console.log("User must click claim button manually - no auto-claiming");
    }
  }, [status, verified, alreadyClaimed, unclaimedCommissions.length, session?.user, verifiedPhone, router]);

  // Add an effect to detect if we've just logged in with pendingPhoneVerification
  useEffect(() => {
    // Check if we have pendingPhoneVerification in URL and we're authenticated
    if (typeof window !== 'undefined' && status === "authenticated" && session?.user) {
      const url = new URL(window.location.href);
      let pendingPhoneParam = url.searchParams.get('pendingPhoneVerification');
      
      // If not found in URL, check sessionStorage as fallback
      if (!pendingPhoneParam) {
        pendingPhoneParam = sessionStorage.getItem('pendingPhoneVerification');
        if (pendingPhoneParam) {
          console.log(`Found pendingPhoneVerification in sessionStorage: ${pendingPhoneParam}`);
          // Clear from sessionStorage to prevent reuse
          sessionStorage.removeItem('pendingPhoneVerification');
        }
      } else {
        console.log(`Found pendingPhoneVerification in URL: ${pendingPhoneParam}`);
      }
      
      if (pendingPhoneParam) {
        console.log(`Found pendingPhoneVerification: ${pendingPhoneParam} - but NOT auto-claiming - user must click the claim button`);
        
        // Set state for verification if not already set
        const storageKey = `verification-data-${pendingPhoneParam}`;
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
          try {
            const data = JSON.parse(savedData);
            if (!verified && data.unclaimedCommissions) {
              console.log(`Restoring verification data for ${pendingPhoneParam}`);
              setVerified(true);
              setVerifiedPhone(pendingPhoneParam);
              setUnclaimedCommissions(data.unclaimedCommissions || []);
              setPhase("SHOW_COMMISSIONS");
            }
          } catch (e) {
            console.error("Error parsing verification data:", e);
          }
        }
      }
    }
  }, [status, session?.user, router, verified]);

  const handleVerificationSuccess = async (phone: string, commissions: any[], alreadyClaimed: boolean) => {
    console.log(`Phone ${phone} verified successfully, found ${commissions.length} unclaimed commissions`);
    console.log("Unclaimed commissions data:", JSON.stringify(commissions, null, 2));
    
    // Update all state values in one batch
    setVerifiedPhone(phone);
    setUnclaimedCommissions(commissions);
    setAlreadyClaimed(alreadyClaimed);
    setVerified(true); // Make sure verified is explicitly set to true
    
    console.log("State after verification success:", {
      verifiedPhone: phone,
      unclaimedCommissions: commissions.length,
      alreadyClaimed,
      verified: true
    });
    
    if (commissions.length === 0) {
      console.log("No commissions found, setting phase to NO_COMMISSIONS");
      setPhase("NO_COMMISSIONS");
    } else if (alreadyClaimed) {
      console.log("Commissions already claimed, setting phase to ALREADY_CLAIMED");
      setPhase("ALREADY_CLAIMED");
    } else {
      console.log("Unclaimed commissions found, setting phase to SHOW_COMMISSIONS");
      setPhase("SHOW_COMMISSIONS");
      
      // Look up the partner ID associated with this phone number
      try {
        const response = await fetch(`/api/partners/lookup?phone=${encodeURIComponent(phone)}`);
        const data = await response.json();
        
        if (data.success && data.partnerId) {
          console.log(`Found partner ID ${data.partnerId} for phone ${phone}`);
          // Store the partner ID in state for later use during sign-in
          localStorage.setItem(`partner-id-${phone}`, data.partnerId);
        } else if (data.success && data.created) {
          console.log(`Created new partner with ID ${data.partnerId} for phone ${phone}`);
          localStorage.setItem(`partner-id-${phone}`, data.partnerId);
        } else {
          console.error(`Could not find or create partner for phone ${phone}`);
        }
      } catch (error) {
        console.error('Error looking up partner ID:', error);
      }

      // Also keep the localStorage backup for now (legacy approach)
      if (typeof window !== 'undefined') {
        const storageKey = `verification-data-${phone}`;
        const verificationData = {
          verified: true,
          phoneNumber: phone,
          unclaimedCommissions: commissions,
          expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
          claimed: false
        };
        
        localStorage.setItem(storageKey, JSON.stringify(verificationData));
        console.log(`Saved verification data to localStorage with key: ${storageKey}`, verificationData);
      }
    }
    
    // Force a re-render to ensure all state updates are applied
    setTimeout(() => {
      console.log("Forcing re-render with current state:", {
        verified: true,
        unclaimedCommissions: commissions.length,
        verifiedPhone: phone,
        alreadyClaimed,
        phase
      });
    }, 0);
  };

  const claimAfterLogin = async () => {
    console.log("Setting readyToClaim to true for the claim button");
    setReadyToClaim(true);
  };

  const handleClaim = async () => {
    if (!verifiedPhone) {
      console.error("Missing verified phone number for claiming");
      return;
    }

    if (status !== "authenticated") {
      console.log("User is not authenticated, redirecting to sign in");
      alert("Your session has expired. Please sign in again to claim your commissions.");
      
      // Get the partner ID if previously looked up
      const partnerId = localStorage.getItem(`partner-id-${verifiedPhone}`);
      
      // Create a state object for the OAuth flow
      const stateObj = {
        pid: partnerId || "unknown",
        phn: verifiedPhone
      };
      
      // Serialize to JSON
      const stateParam = JSON.stringify(stateObj);
      console.log(`Using state parameter for sign in: ${stateParam}`);
      
      // Save verification data in localStorage as fallback
      const storageKey = `verification-data-${verifiedPhone}`;
      const verificationData = {
        verified: true,
        phoneNumber: verifiedPhone,
        unclaimedCommissions,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
        claimed: false
      };
      
      localStorage.setItem(storageKey, JSON.stringify(verificationData));
      console.log(`Saved verification data to localStorage with key: ${storageKey}`);
      
      // Redirect to sign in with state parameter containing partner ID
      const callbackUrl = `/claim`;
      console.log(`Signing in with Google, callbackUrl=${callbackUrl}, state contains partnerId=${partnerId}`);
      
      signIn("google", { 
        callbackUrl: `${window.location.origin}${callbackUrl}`,
        state: stateParam
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Use the new commissions claim endpoint 
      console.log(`Sending claim request for phone: ${verifiedPhone}`);
      const response = await fetch("/api/commissions/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: verifiedPhone
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

      // Access the claimedCount from the data.data object
      const claimedCount = data.data?.claimedCount || 0;
      
      if (claimedCount > 0) {
        // Show success message
        alert(`Successfully claimed ${claimedCount} commissions!`);
        
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

  const verifyCode = async () => {
    if (!phoneNumber || !verificationCode) {
      console.error("Missing phone number or verification code");
      return;
    }

    setIsVerifying(true);
    
    try {
      // Use the verification endpoint
      const response = await fetch("/api/phone-verification/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          code: verificationCode,
        }),
      });

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
        handleVerificationSuccess(phoneNumber, unclaimedCommissions, alreadyClaimed);
        
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
    // Save verification data to localStorage before redirecting
    if (verifiedPhone) {
      const storageKey = `verification-data-${verifiedPhone}`;
      const verificationData = {
        verified: true,
        phoneNumber: verifiedPhone,
        unclaimedCommissions,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
        claimed: false
      };
      
      localStorage.setItem(storageKey, JSON.stringify(verificationData));
      console.log(`Saved verification data to localStorage with key: ${storageKey}`, verificationData);
      
      // Navigate to sign up page with phone number pre-filled
      const registerUrl = `/register?phoneNumber=${encodeURIComponent(verifiedPhone)}&pendingPhoneVerification=${encodeURIComponent(verifiedPhone)}&claim=true`;
      console.log(`Navigating to register: ${registerUrl}`);
      router.push(registerUrl);
    } else {
      router.push('/register');
    }
  };

  const handleSignIn = async () => {
    if (!verifiedPhone) {
      console.log("No verified phone, proceeding with standard sign in");
      signIn("google");
      return;
    }
    
    // Get the partner ID from localStorage if it exists
    const partnerId = localStorage.getItem(`partner-id-${verifiedPhone}`);
    
    if (!partnerId) {
      console.warn(`No partner ID found for phone ${verifiedPhone}, using fallback methods`);
    } else {
      console.log(`Using partner ID ${partnerId} for phone ${verifiedPhone} in OAuth state`);
    }
    
    // Create a minimal state object with just the partner ID
    // This should be small enough to pass through any OAuth provider's state parameter
    const stateObj = {
      pid: partnerId || "unknown",
      phn: verifiedPhone
    };
    
    // Serialize to JSON string
    const stateParam = JSON.stringify(stateObj);
    console.log(`Using state parameter: ${stateParam} (${stateParam.length} chars)`);
    
    // Save verification data in localStorage for fallback
    const storageKey = `verification-data-${verifiedPhone}`;
    const verificationData = {
      verified: true,
      phoneNumber: verifiedPhone,
      unclaimedCommissions,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      claimed: false
    };
    
    localStorage.setItem(storageKey, JSON.stringify(verificationData));
    console.log(`Saved verification data to localStorage with key: ${storageKey}`);
    
    // Use a simple callback URL
    const callbackUrl = `/claim`;
    
    // Log what we're doing for debugging
    console.log(`Signing in with Google, callbackUrl=${callbackUrl}, state contains partnerId=${partnerId}`);
    
    // Sign in with state parameter containing partner ID
    signIn("google", { 
      callbackUrl: `${window.location.origin}${callbackUrl}`,
      state: stateParam
    });
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

  // Add an effect to ensure verified state is set when unclaimedCommissions change
  useEffect(() => {
    if (unclaimedCommissions.length > 0 && !verified) {
      console.log("Commissions found but verified state is false - fixing state");
      setVerified(true);
    }
  }, [unclaimedCommissions, verified]);

  // Add an effect to debug state changes
  useEffect(() => {
    console.log("State values updated:", {
      verified,
      unclaimedCommissions: unclaimedCommissions.length,
      verifiedPhone,
      alreadyClaimed,
      phase,
      readyToClaim
    });
  }, [verified, unclaimedCommissions, verifiedPhone, alreadyClaimed, phase, readyToClaim]);

  return (
    <>
      <Toolbar />
      <NewBackground />
      <div className="relative flex min-h-screen w-full justify-center">
        <Link href="/" className="absolute left-4 top-3 z-10">
          <Wordmark className="h-6" />
        </Link>
        <div className="w-full max-w-md flex items-center justify-center">
          {/* Debug info - only visible in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="fixed top-0 right-0 bg-black bg-opacity-75 text-white p-2 text-xs max-w-xs overflow-auto max-h-60 z-50">
              <div>Phase: {phase}</div>
              <div>Verified: {verified ? 'Yes' : 'No'}</div>
              <div>Commissions: {unclaimedCommissions.length}</div>
              <div>Already Claimed: {alreadyClaimed ? 'Yes' : 'No'}</div>
              <div>Ready to Claim: {readyToClaim ? 'Yes' : 'No'}</div>
              <div>Phone: {verifiedPhone || 'Not set'}</div>
              <div className="flex gap-1 mt-2">
                <button 
                  onClick={() => console.log('Current state:', { 
                    verified, unclaimedCommissions, verifiedPhone, alreadyClaimed, phase
                  })}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                >
                  Log State
                </button>
                <button 
                  onClick={() => {
                    setVerified(false);
                    setUnclaimedCommissions([]);
                    setVerifiedPhone("");
                    setAlreadyClaimed(false);
                    setPhase("VERIFY_PHONE");
                    setReadyToClaim(false);
                    console.log("State reset");
                  }}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
          {/* Using explicit conditions instead of relying solely on verified */}
          {phase === "VERIFY_PHONE" && !verified ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-8 pb-10">
              <h1 className="text-lg font-medium text-neutral-800">
                Verify Your Phone Number
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                Enter your phone number to check if you have any unclaimed commissions.
              </p>
              {verificationExpired && (
                <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                  Your previous verification has expired. Please verify your phone number again.
                </div>
              )}
              <div className="mt-8">
                <PhoneVerificationForm onVerificationSuccess={handleVerificationSuccess} />
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-neutral-200 bg-white p-8 pb-10">
                <h1 className="text-lg font-medium text-neutral-800">
                  Commission Verification
                </h1>
                {alreadyClaimed ? (
                  <>
                    <p className="mt-2 text-sm text-green-600 font-medium">
                      Your commissions have been successfully claimed to your account!
                    </p>
                    {claimedCommissions.length > 0 && (
                      <div className="mt-4 bg-green-50 p-3 rounded-md border border-green-100">
                        <p className="text-green-800 font-medium">
                          You claimed {claimedCommissions.length} commission{claimedCommissions.length !== 1 ? 's' : ''} worth {calculateTotalAmount(claimedCommissions)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-neutral-500">
                    {unclaimedCommissions.length > 0
                      ? `You have ${unclaimedCommissions.length} unclaimed commission${
                          unclaimedCommissions.length === 1 ? "" : "s"
                        }!`
                      : "No unclaimed commissions found for this phone number."}
                  </p>
                )}
                
                <div className="mt-4">
                  {!alreadyClaimed && unclaimedCommissions.length === 0 && (
                    <div className="text-center">
                      <p className="text-sm text-neutral-500">
                        We couldn't find any unclaimed commissions associated with this phone number. 
                        If you believe this is an error, please contact support.
                      </p>
                      <Link href="/" className="mt-4 inline-block font-semibold text-neutral-500 underline underline-offset-2 transition-colors hover:text-black">
                        Return to Home
                      </Link>
                    </div>
                  )}
                  
                  {!alreadyClaimed && unclaimedCommissions.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-500">Total unclaimed amount: {calculateTotalAmount(unclaimedCommissions)}</p>
                      <div className="mt-4 rounded-md bg-neutral-50 p-4">
                        <h3 className="text-sm font-semibold mb-2 text-neutral-800">Commission Details:</h3>
                        <ul className="space-y-2">
                          {unclaimedCommissions.map((commission, index) => (
                            <li key={index} className="text-sm text-neutral-600">
                              {commission.linkTitle ? (
                                <span className="font-medium">{commission.linkTitle || commission.linkKey}</span>
                              ) : (
                                <span className="font-medium">{commission.programName || 'Commission'}</span>
                              )}
                              :{" "}
                              {formatAmount(commission.earnings, commission.currency)} (
                              {new Date(commission.date).toLocaleDateString()})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {alreadyClaimed && (
                    <div className="my-4">
                      <p className="text-sm text-neutral-500">
                        You'll be redirected to your dashboard in a moment...
                      </p>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="my-4">
                      <p className="text-sm text-blue-600">
                        Processing your commissions...
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mt-8">
                  {!alreadyClaimed && unclaimedCommissions.length > 0 && (
                    <>
                      {status === "authenticated" && readyToClaim ? (
                        // Claim button for logged-in users
                        <Button 
                          onClick={handleClaim} 
                          className="w-full"
                          disabled={isProcessing}
                        >
                          {isProcessing ? "Processing..." : `Claim ${calculateTotalAmount(unclaimedCommissions)} Now`}
                        </Button>
                      ) : (
                        // Sign up/sign in options for non-logged in users
                        <div className="space-y-3">
                          <Button onClick={handleSignUp} className="w-full">
                            Create an Account to Claim
                          </Button>
                          <p className="text-center text-sm text-neutral-500">
                            Already have an account?&nbsp;
                            <button
                              onClick={handleSignIn}
                              className="font-semibold text-neutral-500 underline underline-offset-2 transition-colors hover:text-black"
                            >
                              Sign in
                            </button>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
} 