/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'xhzfrmpbhasnipirccnt.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            // HSTS: enforce HTTPS for 1 year, include subdomains
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            // CSP: tighten script/style/connect sources; adjust as needed for external integrations
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: same-origin + inline needed for Next.js hydration (nonce-based CSP requires Next.js middleware)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: same-origin + inline for CSS-in-JS
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + supabase storage + data URIs
              "img-src 'self' data: blob: https://xhzfrmpbhasnipirccnt.supabase.co",
              // Connections: API calls to Supabase
              "connect-src 'self' https://xhzfrmpbhasnipirccnt.supabase.co https://api.github.com",
              // Worker scripts (PDF.js)
              "worker-src 'self' blob:",
              // Frame ancestors: prevent clickjacking
              "frame-ancestors 'none'",
              // Objects: block Flash/plugins
              "object-src 'none'",
              // Base URI restriction
              "base-uri 'self'",
              // Form targets
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
