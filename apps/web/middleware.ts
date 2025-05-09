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
    // Run on all paths except Next internals and static assets
    "/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
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
    
    // Check if we're in localhost environment
    const host = req.headers.get("host");
    
    // All other requests proceed with normal middleware
    if (!host) {
      console.error("No host header found in request");
      return NextResponse.next();
    }

    AxiomMiddleware(req, ev);
    const { domain, path, key, fullKey } = parse(req);
    console.log(`Middleware processing: domain=${domain}, path=${path}, key=${key}`);

    // App routes - treat localhost:8888 as equivalent to app.thereflist.com
    if (APP_HOSTNAMES.has(domain)) {
      return AppMiddleware(req);
    }

    // Localhost debugging for app subdomain paths
    if (domain.includes("localhost") && path.startsWith("/app.thereflist.com")) {
      console.log(`Detected app path on localhost: ${path} - handling via AppMiddleware`);
      return AppMiddleware(req);
    }

    // Handle special paths on the main domain
    if (domain === process.env.NEXT_PUBLIC_APP_DOMAIN) {
      // Serve the homepage for the root path
      if (path === "/") {
        return NextResponse.rewrite(new URL("/", req.url));
      }
      
      // Serve legal pages directly from the top-level legal directory
      if (path.startsWith("/legal/")) {
        return NextResponse.rewrite(new URL(`/legal${path.replace("/legal", "")}`, req.url));
      }
      
      // Redirect /claim to app subdomain where the claim functionality lives
      if (path === "/claim") {
        return NextResponse.redirect(new URL(`https://app.${process.env.NEXT_PUBLIC_APP_DOMAIN}/claim`, req.url));
      }
    }

    // Non-built-in API on custom domain
    if (API_HOSTNAMES.has(domain)) {
      return ApiMiddleware(req);
    }

    // Handle API routes that need CORS (add specific routes as needed)
    // Since the matcher now excludes /api/ routes, we'll handle only the ones we explicitly want
    if (pathname === "/api/shopmy/data" || pathname === "/api/shopmy/pin") {
      // Handle preflight requests
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      }
      
      // For actual requests, add CORS headers
      AxiomMiddleware(req, ev);
      const response = NextResponse.next();
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
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

    // Admin panel
    if (ADMIN_HOSTNAMES.has(domain)) {
      return AdminMiddleware(req);
    }

    // Partners routes
    if (PARTNERS_HOSTNAMES.has(domain)) {
      return PartnersMiddleware(req);
    }

    // Create new link if valid URL
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
