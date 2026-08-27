import { Response } from 'express';

/**
 * httpOnly-cookie session transport.
 *
 * Tokens move out of localStorage into httpOnly cookies so a successful XSS
 * can no longer exfiltrate long-lived credentials:
 *  - `bep_at`: short-lived access token (mirrors the 15m JWT TTL), sent with
 *    every API request.
 *  - `bep_rt`: refresh token scoped to `/api/auth` only — the browser never
 *    presents it anywhere except POST /api/auth/refresh.
 *
 * SameSite=Lax is sufficient CSRF protection here: in production nginx serves
 * the API on the SAME origin (/api proxy) and in development localhost:3000 ->
 * localhost:4000 is same-site (ports are ignored by SameSite). The
 * Authorization Bearer header remains fully supported for Swagger and
 * non-browser API clients.
 */

export const ACCESS_TOKEN_COOKIE = 'bep_at';
export const REFRESH_TOKEN_COOKIE = 'bep_rt';

/** Keep in sync with JWT_EXPIRES_IN (default 15m). */
const ACCESS_TTL_MS = 15 * 60 * 1000;
/** Keep in sync with JWT_REFRESH_EXPIRES_IN (default 7d). */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Secure can be forced via COOKIE_SECURE=true for staging/preview deploys
    // that sit behind TLS but don't set APP_ENV=production (and explicitly
    // disabled with COOKIE_SECURE=false for local HTTP testing). Otherwise it
    // defaults on in production.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.APP_ENV === 'production',
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string | null,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions(),
    path: '/',
    maxAge: ACCESS_TTL_MS,
  });
  if (refreshToken) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...cookieOptions(),
      path: '/api/auth',
      maxAge: REFRESH_TTL_MS,
    });
  }
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...cookieOptions(), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...cookieOptions(),
    path: '/api/auth',
  });
}
