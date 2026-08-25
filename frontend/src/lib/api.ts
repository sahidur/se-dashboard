import axios from 'axios';
import { useAuthStore, logoutAndRedirect } from '@/store/auth-store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Auth rides in httpOnly cookies (`bep_at` / `bep_rt`) set by the API at
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

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Cookie-first refresh: the httpOnly `bep_rt` cookie authenticates the
      // call when present. A body token is only included for transitional
      // sessions that still hold a persisted legacy refresh token.
      const refreshToken = useAuthStore.getState().refreshToken;
      const hadLegacyTokens = !!refreshToken;

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        // Only keep tokens on the store for legacy tabs; cookie-only sessions
        // rely entirely on the rotated cookies the server just set.
        if (hadLegacyTokens && accessToken && newRefreshToken) {
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);
        }

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

