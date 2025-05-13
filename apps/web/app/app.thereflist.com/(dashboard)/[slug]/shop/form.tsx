"use client";

import useWorkspace from "@/lib/swr/use-workspace";
import { ShopMyIntegration } from "@/ui/links/link-builder/components/shopmy-integration";
import { Button } from "@dub/ui";
import { LoadingCircle, Photo } from "@dub/ui/icons";
import { getUrlWithoutUTMParams } from "@dub/utils";
import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useRouter } from "next/navigation";
import { LinkBuilderProvider } from "@/ui/links/link-builder/link-builder-provider";
import { LinkFormData } from "@/ui/links/link-builder/link-form-data";
import { useLinkBuilderSubmit } from "@/ui/links/link-builder/use-link-builder-submit";
import { useMetatags } from "@/ui/links/link-builder/use-metatags";
import { DEFAULT_LINK_PROPS } from "@dub/utils";
import { LinkBuilderProductUrlInput } from "@/ui/links/link-builder/controls/link-builder-product-url-input";
import { ShortLinkInput } from "@/ui/links/short-link-input";

export function Form() {
  const router = useRouter();
  const workspace = useWorkspace();
  const { slug } = workspace;

  if (!slug) {
    return null;
  }

  return (
    <LinkBuilderProvider 
      workspace={workspace} 
      modal={false}
      props={{
        ...DEFAULT_LINK_PROPS,
        productUrl: "",
        commissionSplits: [],
        trackConversion: false,
        domain: "refl.ist", // Force refl.ist domain
      }}
    >
      <ShopFormContent slug={slug} />
    </LinkBuilderProvider>
  );
}

function ShopFormContent({ slug }: { slug: string }) {
  const { control, handleSubmit, watch, setValue, formState: { isSubmitting, isSubmitSuccessful, isDirty } } = useFormContext<LinkFormData>();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadingPreviewImage, setLoadingPreviewImage] = useState(false);
  const router = useRouter();

  const onSubmitSuccess = (data: LinkFormData) => {
    // Store the link data in localStorage for the next step
    localStorage.setItem("shopLinkData", JSON.stringify(data));
    // Redirect to the buyer step
    router.push(`/${slug}/shop/buyer`);
  };

  const onSubmit = useLinkBuilderSubmit({
    onSuccess: onSubmitSuccess,
  });

  const productUrl = watch("productUrl") || "";
  const domain = watch("domain") || "refl.ist";
  const key = watch("key") || "";

  // Set domain to refl.ist and generate a random key when product URL changes
  useEffect(() => {
    if (productUrl) {
      setValue("domain", "refl.ist", { shouldDirty: true });
      // Generate a random 6-character key
      const randomKey = Math.random().toString(36).substring(2, 8);
      setValue("key", randomKey, { shouldDirty: true });
    }
  }, [productUrl, setValue]);

  const [debouncedUrl] = useDebounce(getUrlWithoutUTMParams(productUrl), 500);

  // Update preview image when URL changes
  useEffect(() => {
    if (debouncedUrl) {
      const fn = async () => {
        try {
          // If url is valid, continue to generate metatags
          new URL(debouncedUrl);
          setLoadingPreviewImage(true);

          // Fetch metatags for preview
          const metatagsRes = await fetch(`/api/metatags?url=${debouncedUrl}`);
          if (metatagsRes.ok) {
            const results = await metatagsRes.json();
            setPreviewImage(results.image);
          }
        } catch (error) {
          setPreviewImage(null);
          toast.error("Failed to process URL");
        } finally {
          // Timeout to prevent flickering
          setTimeout(() => {
            setLoadingPreviewImage(false);
          }, 200);
        }
      };

      fn();
    }
  }, [debouncedUrl]);

  useMetatags();

  return (
    <form
      className="flex w-full flex-col gap-y-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <LinkBuilderProductUrlInput />

      <ShopMyIntegration />

      <Controller
        control={control}
        name="key"
        render={({ field }) => (
          <ShortLinkInput
            onChange={() => {}} // Disable onChange to make it read-only
            domain={domain}
            _key={key}
            data={{ url: productUrl, title: "", description: "" }}
            saving={isSubmitting || isSubmitSuccessful}
            loading={false}
            disabled={true} // Make it read-only
          />
        )}
      />

      <div className="flex flex-col gap-2">
        <span className="block text-sm font-medium text-neutral-700">
          Product Preview
        </span>
        <div className="relative aspect-[1.91/1] w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-100">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Preview"
              className="relative size-full rounded-[inherit] object-cover"
            />
          ) : (
            <div className="relative flex size-full flex-col items-center justify-center space-y-4 bg-white">
              <Photo className="h-8 w-8 text-neutral-400" />
              <p className="text-sm text-neutral-400">
                Enter a product URL to generate a preview.
              </p>
            </div>
          )}
          {loadingPreviewImage && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center rounded-[inherit] bg-white">
              <LoadingCircle />
            </div>
          )}
        </div>
      </div>

      <Button
        type="submit"
        text="Continue"
        loading={isSubmitting || isSubmitSuccessful}
        disabled={!isDirty}
      />
    </form>
  );
} 