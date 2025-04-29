import { LinkBuilderProductUrlInput } from "./controls/link-builder-product-url-input";
import { LinkBuilderDestinationUrlInput } from "./controls/link-builder-destination-url-input";
import { ShopMyIntegration } from "./components/shopmy-integration";
import { useRef } from "react";

/**
 * Container component that displays both Product URL and Destination URL fields
 * along with the ShopMy integration when applicable
 */
export function LinkUrlFields() {
  const productUrlRef = useRef<HTMLInputElement>(null);
  const destinationUrlRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* Product URL field - original URL entered by user */}
      <LinkBuilderProductUrlInput ref={productUrlRef} />
      
      {/* ShopMy integration (appears when a valid product URL is entered) */}
      <ShopMyIntegration />
      
      {/* Destination URL field - where users will be redirected */}
      <LinkBuilderDestinationUrlInput ref={destinationUrlRef} />
    </div>
  );
} 