import { NextRequest, NextResponse } from 'next/server';

// Routes that are accessible without authentication
const PUBLIC_PATHS = new Set(['/auth/login']);

// Static asset paths that should never be blocked
const STATIC_PREFIXES = ['/_next', '/favicon', '/icons', '/images'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept static assets or Next.js internals
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow all public auth routes
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Check for the persisted auth state in localStorage via cookie.
  // The Zustand 'se360-auth' key is stored in localStorage (client-only),
  // so we use a lightweight httpOnly session cookie set at login as the
  // server-side signal. If the cookie is absent, redirect to login.
  //
  // NOTE: Tokens are NOT in the cookie — the cookie only signals "was
  // authenticated". Real token validation happens on every API call via
  // the NestJS JwtAuthGuard. This check prevents the unauthenticated
  // flash and protects dashboard routes from crawlers/bots.
  const sessionCookie = request.cookies.get('se360-session');

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all dashboard routes
  matcher: [
    '/dashboard/:path*',
    '/(dashboard)/:path*',
    '/users/:path*',
    '/roles/:path*',
    '/surveys/:path*',
    '/schools/:path*',
    '/categories/:path*',
    '/recycle-bin/:path*',
    '/geo-locations/:path*',
    '/data-collection/:path*',
    '/school-monitoring/:path*',
    '/activity-logs/:path*',
    '/profile/:path*',
  ],
};
