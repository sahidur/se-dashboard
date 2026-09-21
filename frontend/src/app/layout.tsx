import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

// src/proxy.ts issues a per-request CSP nonce, so pages must be dynamically
// rendered — Next.js injects the nonce during SSR and a statically
// prerendered page would carry scripts without it (blocked by the CSP).
// All dashboard data is fetched client-side per request anyway, so nothing
// meaningful is lost by disabling static prerendering here.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SE360',
  description: 'School management, surveys, and reporting platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
