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

/**
 * Wraps the DestinationUrlInput component with link-builder-specific context & logic
 * @see DestinationUrlInput
 */
export const LinkBuilderDestinationUrlInput = memo(
  forwardRef<HTMLInputElement>((_, ref) => {
    const { control, setValue, clearErrors } = useFormContext<LinkFormData>();

    const { errors } = useFormState({ control, name: ["url"] });
    const [domain, key, url] = useWatch({
      control,
      name: ["domain", "key", "url"],
    });

    const { domains } = useAvailableDomains({
      currentDomain: domain,
    });

    return (
      <Controller
        name="url"
        control={control}
        render={({ field }) => (
          <DestinationUrlInput
            ref={ref}
            domain={domain}
            _key={key}
            value={field.value}
            domains={domains}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              clearErrors("url");
              field.onChange(e.target.value);
            }}
            required={key !== "_root"}
            error={errors.url?.message || undefined}
            right={
              <div className="-mb-1 h-6">
                {isValidUrl(url) && (
                  <UTMTemplatesButton
                    onLoad={(params) => {
                      setValue("url", constructURLFromUTMParams(url || '', params), {
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

LinkBuilderDestinationUrlInput.displayName = "LinkBuilderDestinationUrlInput";
