import type { NextConfig } from 'next';
import { configuredProxyOrigin } from './lib/cpanel-api-origin.mjs';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Keep browser requests same-origin (/api) when API runs in a second cPanel app.
  // RELAYWA_API_UPSTREAM is resolved at BUILD time for standalone deployments.
  async rewrites() {
    const origin = configuredProxyOrigin(process.env.RELAYWA_API_UPSTREAM);
    return origin ? [{ source: '/api/:path*', destination: `${origin}/api/:path*` }] : [];
  },
  // /docs is a legacy entry point backed by the same UI as /api-docs.
  // Redirect instead of allowing duplicate indexable copies.
  async redirects() {
    return [
      { source: '/docs', destination: '/api-docs', permanent: true },
    ];
  },
};

export default nextConfig;
