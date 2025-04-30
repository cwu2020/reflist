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
    /*
     * Match all paths except for:
     * 1. /_next/ (Next.js internals)
     * 2. /_proxy/ (proxies for third-party services)
     * 3. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    "/((?!_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};

// CORS headers - needs to be accessible for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://app.thereflist.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  try {
    // Handle CORS preflight requests before any authentication
    if (req.method === 'OPTIONS' && req.nextUrl.pathname.startsWith('/api/')) {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Get the host header safely
    const host = req.headers.get("host");
    if (!host) {
      console.error("No host header found in request");
      return NextResponse.next();
    }

    // Parse the request
    const { domain, path, key, fullKey } = parse(req);

    // Log the parsed values for debugging
    console.log(`Middleware processing: domain=${domain}, path=${path}, key=${key}`);

    AxiomMiddleware(req, ev);

    // For API requests, ensure CORS headers are added
    if (req.nextUrl.pathname.startsWith('/api/')) {
      const response = ApiMiddleware(req);
      // Add CORS headers to the response
      Object.entries(CORS_HEADERS).forEach(([k, v]) => {
        response.headers.set(k, v);
      });
      return response;
    }

    // for App
    if (APP_HOSTNAMES.has(domain)) {
      return AppMiddleware(req);
    }

    // for API
    if (API_HOSTNAMES.has(domain)) {
      return ApiMiddleware(req);
    }

    // for public stats pages (e.g. d.to/stats/try)
    if (path.startsWith("/stats/")) {
      return NextResponse.rewrite(new URL(`/${domain}${path}`, req.url));
    }

    // for .well-known routes
    if (path.startsWith("/.well-known/")) {
      const file = path.split("/.well-known/").pop();
      if (file && supportedWellKnownFiles.includes(file)) {
        return NextResponse.rewrite(
          new URL(`/wellknown/${domain}/${file}`, req.url),
        );
      }
    }

    // default redirects for dub.sh
    if (domain === "dub.sh" && DEFAULT_REDIRECTS[key]) {
      return NextResponse.redirect(DEFAULT_REDIRECTS[key]);
    }

    // for Admin
    if (ADMIN_HOSTNAMES.has(domain)) {
      return AdminMiddleware(req);
    }

    if (PARTNERS_HOSTNAMES.has(domain)) {
      return PartnersMiddleware(req);
    }

    if (isValidUrl(fullKey)) {
      return CreateLinkMiddleware(req);
    }

    return LinkMiddleware(req, ev);
  } catch (error) {
    console.error("Middleware error:", error);
    // Return a 500 error response with appropriate headers
    return NextResponse.rewrite(new URL("/error", req.url), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
      status: 500,
    });
  }
}
