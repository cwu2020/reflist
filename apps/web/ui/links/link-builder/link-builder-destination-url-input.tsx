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
import { DestinationUrlInput } from "../../destination-url-input";
import { useAvailableDomains } from "../../use-available-domains";
import { ShopMyIntegration } from "../components/shopmy-integration";

/**
 * Wraps the DestinationUrlInput component with link-builder-specific context & logic
 * @see DestinationUrlInput
 */
export const LinkBuilderDestinationUrlInput = memo(
  forwardRef<HTMLInputElement>((_, ref) => {
    const { control, setValue, clearErrors } = useFormContext<LinkFormData>();

    const { errors } = useFormState({ control, name: ["productUrl"] });
    const [domain, key, productUrl] = useWatch({
      control,
      name: ["domain", "key", "productUrl", "title", "description"],
    });

    const { domains } = useAvailableDomains({
      currentDomain: domain,
    });

    return (
      <>
        <Controller
          name="productUrl"
          control={control}
          render={({ field }) => (
            <DestinationUrlInput
              ref={ref}
              domain={domain}
              _key={key}
              value={field.value}
              domains={domains}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                clearErrors("productUrl");
                field.onChange(e.target.value);
              }}
              required={key !== "_root"}
              error={errors.productUrl?.message || undefined}
              right={
                <div className="-mb-1 h-6">
                  {isValidUrl(productUrl) && (
                    <UTMTemplatesButton
                      onLoad={(params) => {
                        const newUrl = constructURLFromUTMParams(productUrl, params);
                        setValue("productUrl", newUrl, {
                          shouldDirty: true,
                        });
                        setValue("url", newUrl, {
                          shouldDirty: true,
                        });
                        setValue("originalUrl", newUrl, {
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
        <ShopMyIntegration />
      </>
    );
  }),
); 