'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import api from '@/lib/api';

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

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
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
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden pt-14 lg:ml-64 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
