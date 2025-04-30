import {
  AdminMiddleware,
  ApiMiddleware,
  AppMiddleware,
  AxiomMiddleware,
  CreateLinkMiddleware,
  LinkMiddleware,
} from "@/lib/middleware";
import { parse } from "@/lib/middleware/utils";
import {
  ADMIN_HOSTNAMES,
  API_HOSTNAMES,
  APP_HOSTNAMES,
  DEFAULT_REDIRECTS,
  isValidUrl,
} from "@dub/utils";
import { PARTNERS_HOSTNAMES } from "@dub/utils/src/constants";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import PartnersMiddleware from "./lib/middleware/partners";
import { supportedWellKnownFiles } from "./lib/well-known";

export const config = {
  matcher: [
    "/((?!_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

// CORS headers for the specific cross-origin API route
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://app.thereflist.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  try {
    const { pathname } = req.nextUrl;

    // 1️⃣ CORS preflight for the specific /api/shopmy/data endpoint
    if (req.method === "OPTIONS" && pathname === "/api/shopmy/data") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2️⃣ Handle actual /api/shopmy/data requests with CORS
    if (pathname === "/api/shopmy/data") {
      AxiomMiddleware(req, ev);
      const response = ApiMiddleware(req);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // 3️⃣ All other requests: existing logic
    const host = req.headers.get("host");
    if (!host) {
      console.error("No host header found in request");
      return NextResponse.next();
    }

    const { domain, path, key, fullKey } = parse(req);
    console.log(`Middleware processing: domain=${domain}, path=${path}, key=${key}`);

    AxiomMiddleware(req, ev);

    // Application routes
    if (APP_HOSTNAMES.has(domain)) {
      return AppMiddleware(req);
    }

    // Domain-based API routes (non-cross-origin)
    if (API_HOSTNAMES.has(domain)) {
      return ApiMiddleware(req);
    }

    // Public stats pages
    if (path.startsWith("/stats/")) {
      return NextResponse.rewrite(new URL(`/${domain}${path}`, req.url));
    }

    // .well-known routes
    if (path.startsWith("/.well-known/")) {
      const file = path.split("/.well-known/").pop();
      if (file && supportedWellKnownFiles.includes(file)) {
        return NextResponse.rewrite(
          new URL(`/wellknown/${domain}/${file}`, req.url)
        );
      }
    }

    // Default redirects for dub.sh
    if (domain === "dub.sh" && DEFAULT_REDIRECTS[key]) {
      return NextResponse.redirect(DEFAULT_REDIRECTS[key]);
    }

    // Admin panel
    if (ADMIN_HOSTNAMES.has(domain)) {
      return AdminMiddleware(req);
    }

    // Partners routes
    if (PARTNERS_HOSTNAMES.has(domain)) {
      return PartnersMiddleware(req);
    }

    // Create new link if URL is valid
    if (isValidUrl(fullKey)) {
      return CreateLinkMiddleware(req);
    }

    // Default link redirect handler
    return LinkMiddleware(req, ev);
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.rewrite(new URL("/error", req.url), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
      status: 500,
    });
  }
}
