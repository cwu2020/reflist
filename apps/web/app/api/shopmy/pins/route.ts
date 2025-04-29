import { DubApiError, handleAndReturnErrorResponse } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { ratelimit } from "@/lib/upstash";
import { ipAddress } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const SHOPMY_API_URL = "https://api.shopmy.us/api/Pins";
const SHOPMY_TOKEN = process.env.SHOPMY_CREATOR_TOKEN;
const SHOPMY_USER_ID = process.env.SHOPMY_USER_ID || "104679"; // Static user ID as instructed
const LOCALHOST_IP = "127.0.0.1";

const createPinSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  image: z.string().url().optional(),
  link: z.string().url(),
});

// POST /api/shopmy/pins - Create a new pin through ShopMy API
export async function POST(req: Request) {
  try {
    if (!SHOPMY_TOKEN) {
      console.error("ShopMy API token not configured");
      return NextResponse.json(
        { error: "ShopMy API token not configured" },
        { status: 500 }
      );
    }

    // Verify user is logged in with more detailed logging
    console.log("ShopMy pins: Checking auth session...");
    
    // Log all request headers for debugging
    console.log("ShopMy pins: Request headers:", Object.fromEntries([...req.headers.entries()]));
    
    // Specifically check for auth-related cookies/headers
    const cookies = req.headers.get('cookie');
    console.log("ShopMy pins: Cookies:", cookies);
    
    const session = await getServerSession(authOptions);
    console.log("ShopMy pins: Auth session result:", session ? {
      user: session.user ? { 
        email: session.user.email,
        name: session.user.name,
      } : 'No user'
    } : "No session found");
    
    // TEMPORARY: Add bypass for development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log(`ShopMy pins: Environment is ${isDevelopment ? 'development' : 'production'}`);
    
    // Bypass auth check in development mode
    if (isDevelopment) {
      console.log("ShopMy pins: Bypassing auth check for development environment");
    } 
    // Only enforce auth in non-development environments
    else if (!session?.user) {
      console.log("ShopMy pins: Auth failed - no user in session");
      
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await parseRequestBody(req);
    const pinData = createPinSchema.parse(body);

    console.log(`ShopMy pins: Creating pin for URL: ${pinData.link}`);

    // Rate limit the request
    const ip = process.env.VERCEL === "1" ? ipAddress(req) : LOCALHOST_IP;
    const { success } = await ratelimit().limit(`shopmy-create-pin:${ip}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // For debugging - log the token format (not the actual value)
    console.log(`ShopMy: Token format check - starts with: ${SHOPMY_TOKEN.substring(0, 2)}, length: ${SHOPMY_TOKEN.length}`);

    // Prepare payload with static user ID
    const payload = {
      ...pinData,
      User_id: Number(SHOPMY_USER_ID)
    };

    // Log the exact request payload for debugging
    console.log(`ShopMy: Request payload: ${JSON.stringify(payload)}`);

    try {
      // Make the API request to ShopMy
      const response = await axios.post(
        SHOPMY_API_URL,
        payload,
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
      if (!response.data || !response.data.pin) {
        console.error("ShopMy: Invalid response format - missing pin object", response.data);
        return NextResponse.json(
          { error: "Invalid response from ShopMy API - missing pin data" },
          { status: 502 }
        );
      }

      // Get the pin from the response
      const pin = response.data.pin;
      const shortUrl = `https://go.shopmy.us/p-${pin.id}`;
      
      console.log(`ShopMy: Successfully created pin with ID: ${pin.id}, shortURL: ${shortUrl}`);

      return NextResponse.json({ pin, shortUrl });
    } catch (axiosError) {
      // Handle Axios errors specifically
      if (axios.isAxiosError(axiosError)) {
        console.error("ShopMy API pin creation failed:", {
          url: SHOPMY_API_URL,
          requestPayload: payload,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message
        });
        
        return NextResponse.json(
          { 
            error: `ShopMy API error: ${axiosError.response?.data?.message || axiosError.message || "Failed to create pin"}`,
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