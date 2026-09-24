'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes: cached data shows instantly, refetches in background
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    let userId = useAuthStore.getState().user?.id;
    return useAuthStore.subscribe((state) => {
      const nextId = state.user?.id;
      if (nextId !== userId) {
        userId = nextId;
        queryClient.clear();
      }
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
