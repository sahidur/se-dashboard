'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAuthStore,
  hasSessionCookie,
  setSessionCookie,
  isLoggingOut,
} from '@/store/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import api from '@/lib/api';

const SIDEBAR_COLLAPSED_KEY = 'bep-sidebar-collapsed';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, updateUser } = useAuthStore();
  const router = useRouter();
  // Wait for Zustand persist to rehydrate from localStorage before checking auth.
  // Without this, isAuthenticated is always false on the first render, causing
  // a redirect loop back to login on every page load/refresh.
  const [hydrated, setHydrated] = useState(false);
  // Owned here (not inside Sidebar) so <main> can reclaim the space the
  // collapsed sidebar gives up; read after mount to avoid an SSR mismatch.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      // A logout already triggers its own full-page navigation; a second,
      // competing soft navigation here only races with it.
      if (!isLoggingOut()) router.replace('/auth/login');
      return;
    }
    // We got here authenticated, so the login page's redirect worked — release
    // its loop guard. Also re-issue the middleware cookie if it expired or was
    // cleared while the persisted store survived; otherwise the next navigation
    // would be bounced to the login page, which would send us right back here.
    sessionStorage.removeItem('bep-login-redirect-attempt');
    if (!hasSessionCookie()) setSessionCookie();
  }, [hydrated, isAuthenticated, router]);

  // The `user` object (roles + permissions) is only ever populated at login
  // time and then persisted to localStorage. If an admin edits a role's
  // permissions or assigns/changes a role on an already-logged-in user, that
  // user's browser keeps showing the OLD roles/permissions (stale sidebar
  // menu items, and any page that relies on hasPermission() for its own API
  // calls silently misbehaves) until they log out and back in. Refetch the
  // current user on every dashboard load so permission changes made
  // server-side take effect on next reload/navigation without requiring a
  // fresh login.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    let cancelled = false;
    api
      .get('/users/me')
      .then(({ data }) => {
        if (!cancelled) updateUser(data);
      })
      .catch(() => {
        // If the token is no longer valid the api interceptor already
        // handles logout/redirect on 401; nothing else to do here.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <main
        className={`min-w-0 flex-1 overflow-x-hidden transition-[margin] duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
