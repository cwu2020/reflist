"use client";

import {
  RegisterProvider,
  useRegisterContext,
} from "@/ui/auth/register/context";
import { SignUpForm } from "@/ui/auth/register/signup-form";
import { VerifyEmailForm } from "@/ui/auth/register/verify-email-form";
import { truncate } from "@dub/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function RegisterPageClient() {
  const searchParams = useSearchParams();
  const phoneNumber = searchParams?.get("phoneNumber");
  const claim = searchParams?.get("claim") === "true";
  
  return (
    <RegisterProvider phoneNumber={phoneNumber || undefined} claim={claim}>
      <RegisterFlow />
    </RegisterProvider>
  );
}

const SignUp = () => {
  const { email } = useRegisterContext();
  const searchParams = useSearchParams();
  const phoneNumber = searchParams?.get("phoneNumber");
  const claim = searchParams?.get("claim") === "true";
  
  // Check if we're in localhost environment
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes("localhost");
  
  // Generate the correct login link for localhost environment
  const loginBasePath = isLocalhost ? "/app.thereflist.com/login" : "/login";
  const loginLink = `${loginBasePath}${
    phoneNumber ? `?phoneNumber=${encodeURIComponent(phoneNumber)}&claim=${claim}` : ""
  }`;

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-8 pb-10">
        <h1 className="text-lg font-medium text-neutral-800">
          Create a RefList account
          {phoneNumber && claim && (
            <span className="ml-1 text-sm text-green-600">to claim your earnings</span>
          )}
        </h1>
        {email ? (
          <p className="mt-2 text-sm text-neutral-500">
            An account with {truncate(email, 20)} already exists.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Create an account to start using RefList
            {phoneNumber && claim && ` and claim your earnings`}.
          </p>
        )}
        <div className="mt-8">
          <SignUpForm methods={["email", "google"]} />
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Already have an account?&nbsp;
        <Link
          href={loginLink}
          className="font-semibold text-neutral-500 underline underline-offset-2 transition-colors hover:text-black"
        >
          Sign in
        </Link>
      </p>
    </>
  );
};

const Verify = () => {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-8 pb-10">
      <h1 className="mb-6 text-lg font-medium text-neutral-800">
        Verify your email
      </h1>
      <VerifyEmailForm />
    </div>
  );
};

const RegisterFlow = () => {
  const { step } = useRegisterContext();

  if (step === "signup") return <SignUp />;
  if (step === "verify") return <Verify />;
};
