import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Permission } from '@/types';

// Set a short-lived session cookie readable by the Next.js edge middleware.
// This is NOT a security token — it only signals "user has authenticated".
// The real token validation happens on every API call via the NestJS JWT guard.
function setSessionCookie() {
  if (typeof document === 'undefined') return;
  // SameSite=Strict prevents CSRF. Not HttpOnly because JS must write it.
  document.cookie = 'bep-session=1; path=/; SameSite=Strict; max-age=604800';
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'bep-session=; path=/; SameSite=Strict; max-age=0';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  hasRole: (roleName: string) => boolean;
  hasPermission: (module: string, action: string) => boolean;
  hasAnyRole: (...roleNames: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        setSessionCookie();
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      logout: () => {
        clearSessionCookie();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
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

      hasPermission: (module, action) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles?.some((r) => r.name === 'Super Admin')) return true;

        return (
          user.roles?.some((r) =>
            r.permissions?.some(
              (p: Permission) => p.module === module && p.action === action,
            ),
          ) || false
        );
      },
    }),
    {
      name: 'bep-auth',
      partialize: (state) => ({
        // Persist tokens too so browser reload keeps the session alive.
        // Without this, first API calls after a hard refresh run unauthenticated
        // and force-logout the user.
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
