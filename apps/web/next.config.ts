import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Stage the same-origin API gateway for the VPS migration.
  // Keep /api URLs stable for the browser; preserve paths and query strings.
  // This rewrite must be validated against the deployed Cloudflare Worker gateway
  // before production activation, since Worker-level handlers may take precedence.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://relaywa-vps-origin.relaywa.com/api/:path*',
      },
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
