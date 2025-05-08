import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Label, LoadingSpinner } from "@dub/ui";

type PhoneVerificationFormProps = {
  onVerificationSuccess: (
    phoneNumber: string, 
    commissions: any[], 
    alreadyClaimed?: boolean,
    claimedCommissions?: any[]
  ) => void;
};

export default function PhoneVerificationForm({ onVerificationSuccess }: PhoneVerificationFormProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/phone-verification/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Verification code sent!");
        setCodeSent(true);
      } else {
        toast.error(data.error || "Failed to send verification code");
      }
    } catch (error) {
      toast.error("An error occurred while sending the verification code");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!verificationCode) {
      toast.error("Please enter the verification code");
      return;
    }
    
    setIsVerifying(true);
    
    try {
      // First try the regular verify endpoint
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
      
      // If we get an authentication error, use the fallback endpoint
      if (response.status === 401) {
        console.log("Auth error from regular endpoint, trying fallback endpoint");
        
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
        toast.error(errorData.error || "Verification failed");
        setIsVerifying(false);
        return;
      }
      
      const data = await response.json();
      console.log("Verification response:", data);
      
      if (data.success) {
        toast.success("Phone number verified successfully!");
        
        // Extract data we need
        const alreadyClaimed = data.data?.alreadyClaimed || false;
        const unclaimedCommissions = data.data?.unclaimedCommissions || [];
        const claimedCommissions = data.data?.claimedCommissions || [];
        
        console.log("Verification success data:", { 
          alreadyClaimed, 
          unclaimedCommissions, 
          claimedCommissions 
        });
        
        // Pass the verification result to the parent component
        onVerificationSuccess(phoneNumber, unclaimedCommissions, alreadyClaimed, claimedCommissions);
      } else {
        toast.error(data.error || "Verification failed");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      toast.error("Error verifying code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (isSending) return;
    
    setIsSending(true);
    
    try {
      const response = await fetch("/api/phone-verification/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("New verification code sent!");
        setVerificationCode(""); // Clear previous code
      } else {
        toast.error(data.error || "Failed to resend verification code");
      }
    } catch (error) {
      toast.error("An error occurred while sending the verification code");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const cleaned = value.replace(/\D/g, "");
    
    // Add + prefix if it doesn't exist
    const formattedNumber = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    
    setPhoneNumber(formattedNumber);
  };

  return (
    <>
      {!codeSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => formatPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Enter your phone number with country code (e.g., +1 for US)
            </p>
          </div>
          <Button
            type="submit"
            disabled={isSending}
            className="w-full"
          >
            {isSending ? <LoadingSpinner /> : "Send Verification Code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verificationCode">Verification Code</Label>
            <Input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter the 6-digit code"
              required
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Enter the verification code sent to {phoneNumber}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCodeSent(false)}
              disabled={isVerifying}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isVerifying}
              className="flex-1"
            >
              {isVerifying ? <LoadingSpinner /> : "Verify Code"}
            </Button>
          </div>
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isSending}
              className="text-xs text-blue-600 hover:underline"
            >
              {isSending ? "Sending..." : "Didn't receive a code? Send again"}
            </button>
          </div>
        </form>
      )}
    </>
  );
} 