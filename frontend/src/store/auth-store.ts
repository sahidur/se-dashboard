import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Permission } from '@/types';
import { clearLegacyDrafts } from '@/lib/security';

const SESSION_COOKIE = 'se360-session';

// Set a short-lived session cookie readable by the Next.js edge middleware.
// This is NOT a security token — it only signals "user has authenticated".
// The real token validation happens on every API call via the NestJS JWT guard.
// Only send the cookie over TLS in production; localhost dev is plain HTTP.
const secureFlag = () =>
  typeof location !== 'undefined' && location.protocol === 'https:'
    ? '; Secure'
    : '';

export function setSessionCookie() {
  if (typeof document === 'undefined') return;
  // SameSite=Strict prevents CSRF. Not HttpOnly because JS must write it.
  // Keep in sync with the backend session length (JWT_REFRESH_EXPIRES_IN, 7d).
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Strict${secureFlag()}; max-age=604800`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; SameSite=Strict${secureFlag()}; max-age=0`;
}

// The middleware gates dashboard routes on this cookie while the client gates
// them on the persisted store. The two can drift apart (cookie expires after
// 24 hours, the browser clears cookies but keeps localStorage, cookies are blocked)
// and that drift is what produced the login <-> dashboard redirect loop, so
// callers must be able to ask whether the cookie is actually there.
export function hasSessionCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${SESSION_COOKIE}=`) && c !== `${SESSION_COOKIE}=`);
}

// Set while a logout is navigating away, so route guards don't fire their own
// competing redirect against the full-page navigation.
let loggingOut = false;
export const isLoggingOut = () => loggingOut;

export function logoutAndRedirect(target = '/auth/login') {
  loggingOut = true;
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') window.location.replace(target);
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  hasRole: (roleName: string) => boolean;
  hasPermission: (module: string, action: string, resource?: string) => boolean;
  hasAnyRole: (...roleNames: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => {
        setSessionCookie();
        set({
          user,
          isAuthenticated: true,
        });
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      logout: () => {
        const userId = get().user?.id;
        // Best-effort server-side revocation FIRST: POST /auth/logout clears
        // the stored refresh token and expires the httpOnly session cookies.
        // Without this, "logging out" only wiped client state while the
        // refresh credential stayed usable until its expiry.
        // Raw fetch (not the api client) to avoid an import cycle; keepalive
        // lets the request survive the page teardown of the redirect below;
        // the se360_at cookie authenticates it. Failures are non-blocking.
        if (typeof window !== 'undefined') {
          try {
            const base =
              process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            void fetch(`${base}/auth/logout`, {
              method: 'POST',
              credentials: 'include',
              keepalive: true,
            }).catch(() => {});
          } catch {
            // Network unavailable — local cleanup still proceeds.
          }
        }
        clearSessionCookie();
        set({
          user: null,
          isAuthenticated: false,
        });
        // Drop the persisted copy as well. Relying on the persist middleware to
        // write the cleared state back is not enough when the page is being
        // torn down by a navigation in the same tick — a surviving
        // `isAuthenticated: true` entry makes the login page bounce straight
        // back to the dashboard.
        if (typeof window !== 'undefined') {
          try {
            if (userId) clearLegacyDrafts(window.localStorage, userId);
            window.localStorage.removeItem('se360-auth');
          } catch {
            // Storage can be unavailable (private mode / blocked); state is
            // already cleared in memory, so there is nothing else to do.
          }
        }
      },

      hasRole: (roleName) => {
        const { user } = get();
        return user?.roles?.some((r) => r.name === roleName) || false;
      },

      hasAnyRole: (...roleNames) => {
        const { user } = get();
        return (
          user?.roles?.some((r) => roleNames.includes(r.name)) || false
        );
      },

      // When `resource` is omitted, ANY grant on module+action matches
      // (wildcard or form-scoped). When a resource is given, only an exact
      // grant or a wildcard (resource-less) grant satisfies the check —
      // mirroring the backend PermissionsGuard semantics.
      hasPermission: (module, action, resource) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles?.some((r) => r.name === 'Super Admin')) return true;

        return (
          user.roles?.some((r) =>
            r.permissions?.some(
              (p: Permission) => {
                if (p.module !== module || p.action !== action) return false;
                if (!resource) return true;
                return !p.resource || p.resource === resource;
              },
            ),
          ) || false
        );
      },
    }),
    {
      name: 'se360-auth',
      version: 1,
      migrate: (persisted) => {
        const saved = persisted as Partial<AuthState> | undefined;
        return {
          user: saved?.user ? { ...saved.user, pin: undefined } : null,
          isAuthenticated: saved?.isAuthenticated === true,
        };
      },
      // Older persisted snapshots (or manually modified storage) may contain
      // tokens and private profile fields; never hydrate those back into state.
      merge: (persisted, current) => {
        const saved = persisted as Partial<AuthState> | undefined;
        const user = saved?.user;
        return {
          ...current,
          user: user ? { ...user, pin: undefined } : null,
          isAuthenticated: !!user && saved?.isAuthenticated === true,
        };
      },
      partialize: (state) => ({
        // Credentials live only in httpOnly cookies set by the API.
        // The user object is persisted so the UI can render immediately after
        // a hard reload while the cookie authenticates the actual API calls.
        user: state.user ? { ...state.user, pin: undefined } : null,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window === 'undefined' || !state?.user?.id) return;
        try {
          clearLegacyDrafts(window.localStorage, state.user.id);
        } catch {
          // Browser storage may be disabled; server drafts remain available.
        }
      },
    },
  ),
);
