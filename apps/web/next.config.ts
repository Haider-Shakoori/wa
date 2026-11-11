import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Keep the Cloudflare B2B integration on its existing handler.
  // Only the verified client API families are eligible for VPS routing.
  // The Cloudflare Worker gateway must still be tested for rewrite precedence.
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: 'https://relaywa-vps-origin.relaywa.com/api/auth/:path*' },
      { source: '/api/v1/auth/:path*', destination: 'https://relaywa-vps-origin.relaywa.com/api/v1/auth/:path*' },
      { source: '/api/v1/sessions/:path*', destination: 'https://relaywa-vps-origin.relaywa.com/api/v1/sessions/:path*' },
      { source: '/api/whatsapp-sessions/:path*', destination: 'https://relaywa-vps-origin.relaywa.com/api/whatsapp-sessions/:path*' },
    ];
  },
  // /docs is a legacy entry point backed by the same UI as /api-docs.
  // Redirect instead of allowing duplicate indexable copies.
  async redirects() {
    return [
      { source: '/docs', destination: '/api-docs', permanent: true },
      // Canonicalize the www hostname without touching the rendered UI.
      { source: '/:path*', has: [{ type: 'host', value: 'www.relaywa.com' }], destination: 'https://relaywa.com/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
