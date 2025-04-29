import { DubApiError, handleAndReturnErrorResponse } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { ratelimit } from "@/lib/upstash";
import { ipAddress } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const SHOPMY_API_URL = "https://api.shopmy.us/api/Pins/get_merchant_data";
const SHOPMY_TOKEN = process.env.SHOPMY_CREATOR_TOKEN;
const LOCALHOST_IP = "127.0.0.1";

const getMerchantDataSchema = z.object({
  url: z.string().url()
});

// POST /api/shopmy/data - Get merchant data from ShopMy API
export async function POST(req: Request) {
  try {
    if (!SHOPMY_TOKEN) {
      console.error("ShopMy API token not configured");
      return NextResponse.json(
        { error: "ShopMy API token not configured" },
        { status: 500 }
      );
    }

    // Verify user is logged in
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await parseRequestBody(req);
    const { url } = getMerchantDataSchema.parse(body);

    console.log(`ShopMy: Fetching merchant data for URL: ${url}`);

    // Rate limit the request
    const ip = process.env.VERCEL === "1" ? ipAddress(req) : LOCALHOST_IP;
    const { success } = await ratelimit().limit(`shopmy-get-data:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // For debugging - log the token format (not the actual value)
    console.log(`ShopMy: Token format check - starts with: ${SHOPMY_TOKEN.substring(0, 2)}, length: ${SHOPMY_TOKEN.length}`);
    
    // Extract domain from the URL for ShopMy API
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
      console.log(`ShopMy: Extracted domain: ${domain}`);
    } catch (error) {
      console.error(`ShopMy: Error extracting domain from URL: ${url}`, error);
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }
    
    // Create the correct request body format
    const requestBody = {
      urls: [domain]
    };
    
    // Log the exact request body being sent
    console.log(`ShopMy: Request body: ${JSON.stringify(requestBody)}`);

    // Make the API request to ShopMy
    try {
      const response = await axios.post(
        SHOPMY_API_URL,
        requestBody,
        {
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-apicache-bypass": "true",
            "x-authorization-hash": SHOPMY_TOKEN,
            "Origin": "https://shopmy.us",
            "Referer": "https://shopmy.us/"
          }
        }
      );

      // Debug the response
      console.log(`ShopMy: Response status: ${response.status}`);
      
      // Check for valid data shape
      if (!response.data || !response.data.data) {
        console.error("ShopMy: Invalid response format - missing data object", response.data);
        return NextResponse.json(
          { error: "Invalid response from ShopMy API - missing data" },
          { status: 502 }
        );
      }
      
      // Try to extract domain key and merchant
      const apiData = response.data.data;
      const domainKeys = Object.keys(apiData);
      
      // Debug domain keys
      console.log(`ShopMy: Domain keys found: ${JSON.stringify(domainKeys)}`);
      
      if (!domainKeys.length) {
        console.log("ShopMy: No merchant data found for URL");
        // Return null merchant for frontend to handle
        return NextResponse.json({ merchant: null });
      }
      
      const domainKey = domainKeys[0];
      const merchant = apiData[domainKey];
      
      // Debug merchant data shape
      console.log(`ShopMy: Merchant found - name: ${merchant?.name || 'unknown'}`);

      return NextResponse.json({ merchant });
    } catch (axiosError) {
      // Handle Axios errors specifically
      if (axios.isAxiosError(axiosError)) {
        console.error("ShopMy API request failed:", {
          url: SHOPMY_API_URL,
          requestBody,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message
        });
        
        return NextResponse.json(
          { 
            error: `ShopMy API error: ${axiosError.response?.data?.message || axiosError.message || "Failed to fetch merchant data"}`,
            details: axiosError.response?.data
          },
          { status: axiosError.response?.status || 502 }
        );
      }
      
      // Re-throw other errors
      throw axiosError;
    }
  } catch (error) {
    console.error("ShopMy general error:", error);
    return handleAndReturnErrorResponse(error);
  }
} 