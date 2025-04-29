"use client";

import { DomainProps } from "@/lib/types";
import {
  InfoTooltip,
  SimpleTooltipContent,
  useMediaQuery,
} from "@dub/ui";
import { forwardRef, HTMLProps, ReactNode, useId } from "react";
import { useFormContext } from "react-hook-form";
import { AlertCircleFill } from "../shared/icons";
import { LinkFormData } from "./link-builder/link-form-data";

type ProductUrlInputProps = {
  error?: string;
  right?: ReactNode;
} & HTMLProps<HTMLInputElement>;

export const ProductUrlInput = forwardRef<
  HTMLInputElement,
  ProductUrlInputProps
>(
  (
    {
      error,
      right,
      ...inputProps
    }: ProductUrlInputProps,
    ref,
  ) => {
    const inputId = useId();
    const { isMobile } = useMediaQuery();

    const formContext = useFormContext<LinkFormData>();

    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-neutral-700"
            >
              Product URL
            </label>
            <InfoTooltip
              content={
                <SimpleTooltipContent
                  title="The original product URL you want to share. For eligible products, we'll automatically generate an affiliate link as the destination URL."
                  cta="Learn more."
                  href="https://dub.co/help/article/how-to-create-link"
                />
              }
            />
          </div>
          {right}
        </div>
        <div className="relative mt-2 flex rounded-md shadow-sm">
          <input
            ref={ref}
            name="productUrl"
            id={inputId}
            placeholder="https://example.com/product"
            autoFocus={!isMobile}
            autoComplete="off"
            className={`${
              error
                ? "border-red-300 pr-10 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:ring-neutral-500"
            } block w-full rounded-md focus:outline-none sm:text-sm`}
            aria-invalid="true"
            {...inputProps}
            {...(formContext && {
              onChange: (e) => {
                const productUrl = e.target.value;
                
                // Set both the productUrl and url fields initially
                formContext.setValue("productUrl", productUrl);
                formContext.setValue("url", productUrl); // Initially set url to productUrl, will be replaced by ShopMy URL if eligible
                formContext.setValue("originalUrl", productUrl); // Store product URL in originalUrl for database storage
              },
            })}
          />
          {error && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
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