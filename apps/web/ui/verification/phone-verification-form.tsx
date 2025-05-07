import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Label, LoadingSpinner } from "@dub/ui";

interface PhoneVerificationFormProps {
  onVerificationSuccess: (phoneNumber: string, unclaimedCommissions: any[]) => void;
}

export default function PhoneVerificationForm({ onVerificationSuccess }: PhoneVerificationFormProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsLoading(true);

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
        toast.success("Verification code sent successfully");
        setVerificationSent(true);
      } else {
        toast.error(data.error || "Failed to send verification code");
      }
    } catch (error) {
      toast.error("An error occurred while sending the verification code");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch("/api/phone-verification/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Phone number verified successfully");
        // Pass the verified phone number and any unclaimed commissions back to parent component
        onVerificationSuccess(phoneNumber, data.data?.unclaimedCommissions || []);
      } else {
        toast.error(data.error || "Failed to verify phone number");
      }
    } catch (error) {
      toast.error("An error occurred during verification");
      console.error(error);
    } finally {
      setIsVerifying(false);
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
    <div className="space-y-6">
      {!verificationSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => formatPhoneNumber(e.target.value)}
              required
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Enter your phone number in international format (e.g., +1234567890)
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner className="mr-2" /> : null}
            Send Verification Code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verificationCode">Verification Code</Label>
            <Input
              id="verificationCode"
              type="text"
              placeholder="Enter code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Enter the verification code sent to {phoneNumber}
            </p>
          </div>
          <div className="flex flex-col space-y-2">
            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying ? <LoadingSpinner className="mr-2" /> : null}
              Verify Code
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setVerificationSent(false)}
              disabled={isVerifying}
            >
              Change Phone Number
            </Button>
          </div>
        </form>
      )}
    </div>
  );
} 