/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hides the floating Next.js dev overlay badge in the browser corner
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
      },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking (OWASP A05)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy — disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS — enforce HTTPS for 1 year (enable in production behind HTTPS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is required in dev mode for Next.js Fast Refresh/HMR
              // (webpack eval-source-maps). Without it, React event handlers can
              // silently fail to attach, causing forms to fall back to native
              // browser submission (full page reload, credentials leaked in URL).
              // It is NOT included in production builds.
              isDev
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.digitaloceanspaces.com",
              "font-src 'self'",
              // Allow both localhost (dev) and the production API domain (prod)
              "connect-src 'self' http://localhost:4000 https://se.somadhanhobe.com https://*.digitaloceanspaces.com" +
                (isDev ? ' ws://localhost:3000' : ''),
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
