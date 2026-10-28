import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
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
