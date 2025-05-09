"use client";

import { sendOtpAction } from "@/lib/actions/send-otp";
import z from "@/lib/zod";
import { signUpSchema } from "@/lib/zod/schemas/auth";
import { Button, Input } from "@dub/ui";
import { useAction } from "next-safe-action/hooks";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRegisterContext } from "./context";

type SignUpProps = z.infer<typeof signUpSchema>;

export const SignUpEmail = () => {
  const { 
    setStep, 
    setEmail, 
    setPassword, 
    setPhoneNumber,
    setClaim,
    email, 
    lockEmail 
  } = useRegisterContext();
  
  const searchParams = useSearchParams();
  const phoneNumberParam = searchParams?.get("phoneNumber");
  const claimParam = searchParams?.get("claim");

  // Set phone number and claim flags from URL parameters
  useEffect(() => {
    if (phoneNumberParam) {
      setPhoneNumber(phoneNumberParam);
    }
    if (claimParam === "true") {
      setClaim(true);
    }
  }, [phoneNumberParam, claimParam, setPhoneNumber, setClaim]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<SignUpProps>({
    defaultValues: {
      email,
    },
  });

  const { executeAsync, isPending } = useAction(sendOtpAction, {
    onSuccess: () => {
      setEmail(getValues("email"));
      setPassword(getValues("password"));
      setStep("verify");
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ||
          error.validationErrors?.email?.[0] ||
          error.validationErrors?.password?.[0],
      );
    },
  });

  return (
    <form onSubmit={handleSubmit(async (data) => await executeAsync(data))}>
      <div className="flex flex-col space-y-4">
        <Input
          type="email"
          placeholder="Work Email"
          autoComplete="email"
          required
          readOnly={!errors.email && lockEmail}
          {...register("email")}
          error={errors.email?.message}
        />
        <Input
          type="password"
          placeholder="Password"
          required
          {...register("password")}
          error={errors.password?.message}
          minLength={8}
        />
        {phoneNumberParam && (
          <div className="text-sm text-green-600">
            <p>You'll be able to claim your earnings after registration.</p>
          </div>
        )}
        <Button
          type="submit"
          text={isPending ? "Submitting..." : "Sign Up"}
          disabled={isPending}
          loading={isPending}
        />
      </div>
    </form>
  );
};
