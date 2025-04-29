import { fetchShopMyMerchantData, isShopMyEligible, ShopMyMerchantData } from "@/lib/shopmy";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { LinkFormData } from "../link-form-data";
import { LoadingCircle } from "@dub/ui/icons";
import { Badge } from "@dub/ui";

export function ShopMyIntegration() {
  const { setValue } = useFormContext<LinkFormData>();
  const [productUrl] = useWatch({ name: ["productUrl"] });
  
  const [loading, setLoading] = useState(false);
  const [merchantData, setMerchantData] = useState<ShopMyMerchantData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch merchant data when productUrl changes
  useEffect(() => {
    if (!productUrl || !isShopMyEligible(productUrl)) {
      setMerchantData(null);
      setError(null);
      return;
    }

    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchShopMyMerchantData(productUrl);
        if (data) {
          setMerchantData(data);
          // Store merchant data and set the product URL in originalUrl
          setValue("shopmyMetadata" as any, data, { shouldDirty: true });
          setValue("originalUrl" as any, productUrl, { shouldDirty: true });
          // url remains productUrl until form submission, when it will be replaced with ShopMy URL
        } else {
          setMerchantData(null);
          setError("No merchant data found for this URL");
        }
      } catch (err) {
        console.error("Error fetching ShopMy merchant data:", err);
        setError("Failed to fetch merchant data");
        setMerchantData(null);
      } finally {
        setLoading(false);
      }
    }

    // Use debounce to avoid too many requests
    const timer = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timer);
  }, [productUrl, setValue]);

  // If no productUrl or not eligible, don't show anything
  if (!productUrl || !isShopMyEligible(productUrl)) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="blue">ShopMy</Badge>
          <span className="text-sm text-neutral-600">
            {loading 
              ? "Checking for affiliate program..." 
              : merchantData 
                ? "Affiliate program detected!" 
                : "No affiliate program found"}
          </span>
        </div>
        {loading && <LoadingCircle className="h-4 w-4 text-neutral-500" />}
      </div>

      {merchantData && (
        <div className="mt-2">
          <div className="flex items-center gap-3">
            {merchantData.logo && (
              <img 
                src={merchantData.logo} 
                alt={merchantData.name} 
                className="h-10 w-10 rounded-md object-cover"
              />
            )}
            <div>
              <p className="font-medium">{merchantData.name}</p>
              <p className="text-sm text-neutral-600">
                {merchantData.payoutType === "percentage" 
                  ? `${merchantData.fullPayout}% commission` 
                  : `${merchantData.fullPayout}% commission`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            This product URL will be automatically converted to a ShopMy affiliate link as the destination URL when saved.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
} 