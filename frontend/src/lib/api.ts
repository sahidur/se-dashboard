import axios, { AxiosError, isAxiosError } from 'axios';
import { useAuthStore, logoutAndRedirect, hasSessionCookie, setSessionCookie } from '@/store/auth-store';
import { isApiRequestUrl } from '@/lib/security';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Auth rides in httpOnly cookies (`se360_at` / `se360_rt`) set by the API at
  // login; the browser attaches them automatically. withCredentials is what
  // makes that work for the cross-origin dev setup (localhost:3000 -> :4000);
  // production is same-origin via the nginx /api proxy.
  withCredentials: true,
});

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Keep credentialed requests on the configured API origin.
api.interceptors.request.use(
  (config) => {
    if (!isApiRequestUrl(config.url ?? '', API_BASE_URL, config.baseURL)) {
      throw new Error('API request must target the configured API base');
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Single-flight refresh: when the access token expires, several in-flight
// requests can 401 at the same time (e.g. the batch of queries fired when the
// user returns to an inactive tab). The backend rotates the refresh token on
// every /auth/refresh call, so letting each 401 refresh independently makes
// all but the first fail and wrongly logs the user out. Sharing one promise
// queues every 401 behind a single refresh call instead.
let refreshPromise: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // Cookie-only refresh: the httpOnly `se360_rt` cookie authenticates the
      // call and the server rotates both cookies in its response. Never send
      // a token in the request body — request bodies are more likely to end
      // up in logs/proxies than cookies scoped to /api/auth.
      await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
        withCredentials: true,
      });
      // The API rotates both httpOnly cookies; keep the routing marker alive too.
      if (useAuthStore.getState().isAuthenticated) setSessionCookie();
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshSession();
        return api(originalRequest);
      } catch (refreshError) {
        // Only a definitive rejection from the refresh endpoint (401 = the
        // refresh token is invalid/expired/revoked, 400 = no refresh token
        // at all) proves the session is dead. A network blip must NOT log
        // the user out mid-work — let the request fail and let the next one
        // retry the refresh.
        const refreshStatus = isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;
        if (refreshStatus !== 401 && refreshStatus !== 400) {
          return Promise.reject(error);
        }
        // Refresh token is invalid/expired — fall through to forced logout below.
      }

      // An invalid/expired refresh cookie means the session can no longer be
      // trusted: log the user out and send them back to the login page
      // instead of silently leaving the app in a "loaded but no data" state.
      // The logout must clear the persisted store *and* the middleware cookie,
      // otherwise the login page would see a stale "authenticated" state and
      // bounce straight back to the dashboard.
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/auth/login'
      ) {
        const from = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        logoutAndRedirect(`/auth/login?from=${from}`);
      } else {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;

// Proactive session refresh: while the user keeps the tab open and visible,
// silently refresh the httpOnly cookies every 10 minutes — well inside the
// 15-minute access-token TTL — so background work or a long-running request
// never lands on an expired token. The backend rotates the refresh token on
// every call and stores it in the shared cookie jar, so multiple tabs are
// safe (each reads the newest cookie, plus the backend's 60s rotation grace
// window). Failures are deliberately silent here: the reactive interceptor
// above handles genuine 401s and is the only place that decides to log out.
const PROACTIVE_REFRESH_MS = 10 * 60 * 1000;

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (window.location.pathname.startsWith('/auth')) return;
    if (!hasSessionCookie()) return;
    void refreshSession().catch(() => {});
  }, PROACTIVE_REFRESH_MS);
}

export function getErrorMessage(error: unknown, fallback = 'Operation failed'): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

