import axios, { AxiosError } from 'axios';
import { useAuthStore, logoutAndRedirect } from '@/store/auth-store';

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

// Request interceptor - add auth token (legacy: only present while an
// in-memory token from this tab's login is still around; cookie sessions
// need no header).
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      } catch {
        // Refresh token is invalid/expired — fall through to forced logout below.
      }

      // Either there was no refresh token (session lost, e.g. after a hard
      // reload) or the refresh attempt itself failed (backend session/token
      // expired or was revoked). In both cases the session can no longer be
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

export function getErrorMessage(error: unknown, fallback = 'Operation failed'): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

