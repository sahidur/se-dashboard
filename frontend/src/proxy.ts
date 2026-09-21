import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge proxy (Next 16 successor of middleware.ts).
 *
 * 1. Route protection: the client-side layout guard is cosmetic — it can be
 *    flipped by tampering with localStorage. The proxy gates dashboard routes
 *    on the `se360-session` flag cookie BEFORE any dashboard code is served.
 *    This is not a security token; real authorization stays server-side in
 *    the NestJS JWT guards (every data request goes through the API). The
 *    proxy's job is to stop unauthenticated browsers from ever receiving
 *    dashboard HTML/JS and to bounce already-authenticated users off the
 *    auth pages.
 *
 * 2. Strict CSP: in production a per-request nonce replaces the previous
 *    `script-src 'unsafe-inline'`, which would let ANY injected inline
 *    <script> execute. Next.js applies the nonce to its own framework and
 *    page scripts automatically when the CSP header is set on the request.
 *    Because a nonce is request-scoped, pages must be dynamically rendered
 *    (root layout sets `dynamic = 'force-dynamic'`).
 */

const SESSION_COOKIE = 'se360-session';

function buildCsp(nonce: string, isDev: boolean): string {
  // In dev, React/Next needs 'unsafe-eval' (Fast Refresh / debug stacks) and
  // 'unsafe-inline' for the dev overlay. Production gets the strict set.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  // Runtime style injection (e.g. animations) cannot be nonce'd reliably;
  // styles are far lower risk than scripts, so 'unsafe-inline' stays for CSS.
  const styleSrc = isDev ? `'self' 'unsafe-inline'` : `'self' 'unsafe-inline'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: https://*.digitaloceanspaces.com",
    "font-src 'self'",
    "connect-src 'self' https://*.digitaloceanspaces.com" +
      (isDev ? ' http://localhost:4000 ws://localhost:3000' : ''),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage =
    pathname === '/auth/login' || pathname === '/auth/register';

  // ── 1. Route protection ────────────────────────────────────────────────
  if (!hasSession && !isAuthPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.search = '';
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname + search);
    }
    const redirect = NextResponse.redirect(loginUrl);
    // Auth-gated responses must never be cached (a cached redirect could pin
    // a logged-in user out, or worse cache the dashboard HTML for others).
    redirect.headers.set('Cache-Control', 'no-store');
    return redirect;
  }

  if (hasSession && isAuthPage) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    dashUrl.search = '';
    return NextResponse.redirect(dashUrl);
  }

  // ── 2. Content-Security-Policy with per-request nonce ──────────────────
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // All paths except API routes, Next static assets, image optimisation and
    // the favicon. Prefetches are excluded so they don't burn nonces.
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
