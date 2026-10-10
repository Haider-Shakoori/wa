import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  // /docs is a legacy entry point backed by the same UI as /api-docs.
  // Redirect instead of allowing duplicate indexable copies.
  async redirects() {
    return [
      { source: '/docs', destination: '/api-docs', permanent: true },
    ];
  },
};

export default nextConfig;
