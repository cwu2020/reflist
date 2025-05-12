"use client";

import { SignUpEmail } from "./signup-email";
import { SignUpOAuth } from "./signup-oauth";
import { useSearchParams } from "next/navigation";

export const SignUpForm = ({
  methods = ["email", "google"],
}: {
  methods?: ("email" | "google")[];
}) => {
  const searchParams = useSearchParams();
  const claim = searchParams?.get("claim") === "true";
  
  // If this is a claim process, only show email method
  const effectiveMethods: ("email" | "google")[] = claim ? ["email"] : methods;
  
  return (
    <div className="flex flex-col gap-3">
      {effectiveMethods.includes("email") && <SignUpEmail />}
      {!claim && effectiveMethods.length > 1 && (
        <div className="my-2 flex flex-shrink items-center justify-center gap-2">
          <div className="grow basis-0 border-b border-neutral-300" />
          <span className="text-xs font-normal uppercase leading-none text-neutral-500">
            or
          </span>
          <div className="grow basis-0 border-b border-neutral-300" />
        </div>
      )}
      {!claim && <SignUpOAuth methods={effectiveMethods} />}
    </div>
  );
};
