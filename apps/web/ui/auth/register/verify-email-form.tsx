"use client";

import { createUserAccountAction } from "@/lib/actions/create-user-account";
import { AnimatedSizeContainer, Button, useMediaQuery, Wordmark } from "@dub/ui";
import { cn } from "@dub/utils";
import { OTPInput, SlotProps } from "input-otp";
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
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const { executeAsync, isPending } = useAction(createUserAccountAction, {
    async onSuccess() {
      // Show different toast message based on whether user is claiming commissions
      if (claim && phoneNumber) {
        toast.success("Account created! Your unclaimed earnings are now available in your dashboard.");
      } else {
        toast.success("Account created! Redirecting to dashboard...");
      }
      
      setIsRedirecting(true);

      // Sign in to create session
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (response?.ok) {
        if (claim && phoneNumber) {
          // For claim users, the ClaimCommissionService creates a workspace asynchronously
          // Show loading animation while waiting
          setIsCreatingWorkspace(true);
          
          // Function to fetch workspaces with retry logic
          const getWorkspaceWithRetry = async (maxRetries = 5, delayMs = 1000) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                console.log(`Attempt ${attempt} to fetch user workspaces...`);
                // Wait a bit longer with each attempt
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                
                const workspacesResponse = await fetch('/api/workspaces');
                
                if (workspacesResponse.ok) {
                  const workspaces = await workspacesResponse.json();
                  
                  if (workspaces && workspaces.length > 0 && workspaces[0].slug) {
                    console.log(`Found workspace: ${workspaces[0].slug} on attempt ${attempt}`);
                    return workspaces[0];
                  }
                }
                console.log(`No workspace found on attempt ${attempt}, retrying...`);
              } catch (error) {
                console.error(`Error fetching workspaces on attempt ${attempt}:`, error);
              }
            }
            return null;
          };
          
          // Try to fetch the user's workspace with retries
          const workspace = await getWorkspaceWithRetry();
          
          if (workspace && workspace.slug) {
            // Direct redirect to the user's workspace if found
            console.log(`Redirecting user to workspace: /${workspace.slug}`);
            router.push(`/${workspace.slug}`);
          } else {
            // Fallback if the workspace still can't be found after retries
            console.log("No workspace found after retries, redirecting to /workspaces");
            router.push("/workspaces");
          }
        } else {
          // Normal users - workspace is created automatically during account creation
          const workspacesResponse = await fetch('/api/workspaces');
          if (workspacesResponse.ok) {
            const workspaces = await workspacesResponse.json();
            // Since workspace is created automatically, we can safely access the first workspace
            router.push(`/${workspaces[0].slug}`);
          } else {
            console.error("Failed to fetch workspaces after account creation");
            toast.error("Something went wrong. Please try again or contact support.");
          }
        }
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
        {isCreatingWorkspace ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative flex w-auto items-center justify-center px-6 py-2 [--offset:20px] [animation-duration:1.3s] [animation-fill-mode:both]">
              <div className="absolute inset-0 opacity-10">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse-scale absolute inset-0 rounded-full mix-blend-color-burn"
                    style={{
                      animationDelay: `${i * -2}s`,
                      backgroundImage: `linear-gradient(90deg, #000, transparent, #000)`,
                    }}
                  />
                ))}
              </div>
              <Wordmark className="relative h-12" />
            </div>
            <p className="text-sm text-neutral-500">Setting up your account...</p>
          </div>
        ) : (
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
                render={({ slots, isFocused }) => (
                  <>
                    {slots.map((slot, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "outline-none ring-offset-background rounded-md appearance-none h-9 aspect-square bg-transparent border border-neutral-300 flex items-center justify-center transition-colors",
                          {
                            "border-red-500": isInvalidCode,
                            "border-blue-500 bg-blue-50": isFocused && idx === slots.findIndex(s => !s.char),
                            "border-neutral-400": slot.char
                          }
                        )}
                      >
                        {slot.char}
                      </div>
                    ))}
                  </>
                )}
                autoFocus
              />
              {isInvalidCode && (
                <div className="text-center text-xs font-normal leading-none text-red-500">
                  Invalid code, please try again.
                </div>
              )}
            </div>
            <Button
              text={isPending || isRedirecting ? "Verifying..." : "Verify Email"}
              className="w-full"
              type="submit"
              loading={isPending || isRedirecting}
              disabled={isPending || isRedirecting || code.length < 6}
            />
            <ResendOtp email={email} />
          </form>
        )}
      </AnimatedSizeContainer>
    </>
  );
};
