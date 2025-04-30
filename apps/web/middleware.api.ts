import { NextResponse, type NextRequest } from 'next/server'

const ORIGIN = 'https://app.thereflist.com'
const ALLOWED = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function middleware(req: NextRequest) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: ALLOWED })
  }

  // All other requests
  const res = NextResponse.next()
  Object.entries(ALLOWED).forEach(([k,v]) => res.headers.set(k, v))
  return res
}

// Only run on API routes
export const config = {
  matcher: '/api/:path*',
} 