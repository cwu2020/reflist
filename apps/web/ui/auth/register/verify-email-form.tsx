"use client";

import { createUserAccountAction } from "@/lib/actions/create-user-account";
import { AnimatedSizeContainer, Button, useMediaQuery } from "@dub/ui";
import { cn } from "@dub/utils";
import { OTPInput } from "input-otp";
import { signIn } from "next-auth/react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRegisterContext } from "./context";
import { ResendOtp } from "./resend-otp";

export const VerifyEmailForm = () => {
  const router = useRouter();
  const { isMobile } = useMediaQuery();
  const [code, setCode] = useState("");
  const { email, password, phoneNumber, claim } = useRegisterContext();
  const [isInvalidCode, setIsInvalidCode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { executeAsync, isPending } = useAction(createUserAccountAction, {
    async onSuccess() {
      // Show different toast message based on whether user is claiming commissions
      if (claim && phoneNumber) {
        toast.success("Account created! Your unclaimed earnings are now available in your dashboard.");
      } else {
        toast.success("Account created! Redirecting to dashboard...");
      }
      
      setIsRedirecting(true);

      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (response?.ok) {
        router.push("/onboarding");
      } else {
        toast.error(
          "Failed to sign in with credentials. Please try again or contact support.",
        );
      }
    },
    onError({ error }) {
      toast.error(error.serverError);
      setCode("");
      setIsInvalidCode(true);
    },
  });

  if (!email || !password) {
    router.push("/register");
    return;
  }

  return (
    <>
      <AnimatedSizeContainer>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            executeAsync({
              email,
              password,
              code,
              phoneNumber,
              claim,
            });
          }}
        >
          <div>
            <div className="pb-2 text-sm font-medium">
              We've sent a verification code to <b>{email}</b>
            </div>
            <OTPInput
              maxLength={6}
              containerClassName="flex justify-center gap-2 pb-2"
              value={code}
              onChange={(value) => {
                setCode(value);
                setIsInvalidCode(false);
              }}
              itemClassName={cn(
                "outline-none ring-offset-background rounded-md appearance-none h-9 aspect-square bg-transparent border border-neutral-300 flex items-center justify-center",
                {
                  "border-red-500": isInvalidCode,
                },
              )}
              render={({ slots }) => (
                <>
                  {slots.map((slot, idx) => (
                    <div key={idx}>{slot}</div>
                  ))}
                </>
              )}
            />
            {isInvalidCode && (
              <div className="text-center text-xs font-normal leading-none text-red-500">
                Invalid code, please try again.
              </div>
            )}
          </div>
          <Button
            text={isPending || isRedirecting ? "Verifying..." : "Verify Email"}
            fullWidth
            type="submit"
            loading={isPending || isRedirecting}
            disabled={isPending || isRedirecting || code.length < 6}
          />
          <ResendOtp />
        </form>
      </AnimatedSizeContainer>
    </>
  );
};
