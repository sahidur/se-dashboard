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
    void isDev;

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
          // NOTE: the Content-Security-Policy header is set by src/proxy.ts
          // (nonce-based, per-request). Setting it here as well would emit TWO
          // CSP headers and browsers enforce their intersection, which breaks
          // the nonce. Keep the CSP in proxy.ts only.
        ],
      },
    ];
  },
};

module.exports = nextConfig;
