import { LinkFormData } from "@/ui/links/link-builder/link-form-data";
import { UTMTemplatesButton } from "@/ui/links/link-builder/utm-templates-button";
import { constructURLFromUTMParams, isValidUrl } from "@dub/utils";
import { forwardRef, memo } from "react";
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";
import { ProductUrlInput } from "../../product-url-input";

/**
 * Wraps the ProductUrlInput component with link-builder-specific context & logic
 */
export const LinkBuilderProductUrlInput = memo(
  forwardRef<HTMLInputElement>((_, ref) => {
    const { control, setValue, clearErrors } = useFormContext<LinkFormData>();

    const { errors } = useFormState({ control, name: ["productUrl"] });
    const [productUrl] = useWatch({
      control,
      name: ["productUrl"],
    });

    // Ensure productUrl is a string for isValidUrl check
    const safeProductUrl = productUrl || '';

    return (
      <Controller
        name="productUrl"
        control={control}
        render={({ field }) => (
          <ProductUrlInput
            ref={ref}
            value={field.value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              clearErrors("productUrl");
              field.onChange(e.target.value);
            }}
            required={true}
            error={errors.productUrl?.message || undefined}
            right={
              <div className="-mb-1 h-6">
                {isValidUrl(safeProductUrl) && (
                  <UTMTemplatesButton
                    onLoad={(params) => {
                      const newUrl = constructURLFromUTMParams(safeProductUrl, params);
                      setValue("productUrl", newUrl, {
                        shouldDirty: true,
                      });
                      setValue("url", newUrl, {
                        shouldDirty: true,
                      });
                      setValue("originalUrl" as any, newUrl, {
                        shouldDirty: true,
                      });
                    }}
                  />
                )}
              </div>
            }
          />
        )}
      />
    );
  }),
); 