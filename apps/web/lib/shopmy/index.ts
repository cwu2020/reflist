import axios from "axios";

// Get the base URL for API requests - handles both client and server environments
function getBaseUrl(): string {
  // Use a default URL for server-side rendering
  const baseURL = process.env.NEXT_PUBLIC_VERCEL_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8888';
  
  return baseURL;
}

// Type definitions for ShopMy API responses
export interface ShopMyMerchantData {
  id: number;
  domain: string;
  name: string;
  logo: string;
  source: string;
  fullPayout: number;
  payoutType: string;
  rateType: string;
  isSMSWinner: number;
  raw: string;
  updatedAt: string;
  Brand_id: number;
  brand: {
    id: number;
    name: string;
    logo: string;
    description?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ShopMyPin {
  id: number;
  link: string;
  [key: string]: any;
}

// Function to fetch merchant data for a URL
export async function fetchShopMyMerchantData(url: string): Promise<ShopMyMerchantData | null> {
  try {
    // Call our internal API proxy to get merchant data with absolute URL
    const baseURL = getBaseUrl();
    const response = await axios.post(`${baseURL}/api/shopmy/data`, { url });
    return response.data.merchant;
  } catch (error) {
    // Handle different types of errors
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error("Authentication error: User not logged in");
      } else if (error.response?.status === 500) {
        console.error("Server error: ShopMy API token might not be configured");
      } else {
        console.error(`ShopMy API error (${error.response?.status}):`, error.response?.data?.error || error.message);
      }
    } else {
      console.error("Error fetching ShopMy merchant data:", error);
    }
    return null;
  }
}

// Function to create a ShopMy pin
export async function createShopMyPin({
  title,
  description,
  image,
  link,
}: {
  title: string;
  description?: string;
  image?: string;
  link: string;
}): Promise<{ pin: ShopMyPin; shortUrl: string } | null> {
  try {
    // Call our internal API proxy to create a pin with absolute URL
    const baseURL = getBaseUrl();
    
    // Add better logging to debug authentication issues
    console.log(`ShopMy client: Making request to ${baseURL}/api/shopmy/pins`);
    console.log(`ShopMy client: Payload:`, { title, description, image, link });
    
    const response = await axios.post(`${baseURL}/api/shopmy/pins`, {
      title,
      description,
      image,
      link,
    }, {
      // Important: Send cookies and credentials for auth
      withCredentials: true
    });
    
    return response.data;
  } catch (error) {
    // Handle different types of errors
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        console.error("Authentication error: User not logged in");
        console.error("Request URL:", `${getBaseUrl()}/api/shopmy/pins`);
        console.error("Request details:", { withCredentials: true });
      } else if (error.response?.status === 500) {
        console.error("Server error: ShopMy API token might not be configured");
      } else {
        console.error(`ShopMy API error (${error.response?.status}):`, error.response?.data?.error || error.message);
      }
    } else {
      console.error("Error creating ShopMy pin:", error);
    }
    return null;
  }
}

// Function to check if a URL is eligible for ShopMy affiliate
export function isShopMyEligible(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Return true for now - in production, you may want to check against a list
    // of known shopmy-supported domains or use their API to verify
    return true;
  } catch (error) {
    return false;
  }
} 