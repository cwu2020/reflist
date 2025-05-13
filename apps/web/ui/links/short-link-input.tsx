"use client";

import { LinkProps } from "@/lib/types";
import { cn } from "@dub/utils";
import { forwardRef, HTMLProps, useId } from "react";
import { AlertCircleFill } from "../shared/icons";

type ShortLinkInputProps = {
  domain?: string;
  _key?: string;
  existingLinkProps?: Pick<LinkProps, "key">;
  error?: string;
  onChange: (data: { domain?: string; key?: string }) => void;
  data: Pick<LinkProps, "url" | "title" | "description">;
  saving: boolean;
  loading: boolean;
  onboarding?: boolean;
} & Omit<HTMLProps<HTMLInputElement>, "onChange" | "data">;

export const ShortLinkInput = forwardRef<HTMLInputElement, ShortLinkInputProps>(
  (
    {
      domain,
      _key: key,
      existingLinkProps,
      error: errorProp,
      onChange,
      data,
      saving,
      loading,
      onboarding,
      ...inputProps
    }: ShortLinkInputProps,
    ref,
  ) => {
    const inputId = useId();
    const error = errorProp;

    return (
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700"
          >
            Short Link
          </label>
        </div>
        <div className="relative mt-1 flex rounded-md shadow-sm">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-neutral-500 sm:text-sm">
            {domain}
          </span>
          <input
            ref={ref}
            type="text"
            name="key"
            id={inputId}
            disabled={true}
            autoComplete="off"
            autoCapitalize="none"
            className={cn(
              "block w-full rounded-r-md border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm",
              "z-0 focus:z-[1]",
              {
                "border-red-300 pr-10 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500":
                  error,
                "cursor-not-allowed border border-neutral-300 bg-neutral-100 text-neutral-500":
                  true,
              },
            )}
            value={key}
            {...inputProps}
          />
          {error && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <AlertCircleFill
                className="h-5 w-5 text-red-500"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" id="key-error">
            {error}
          </p>
        )}
      </div>
    );
  },
);
