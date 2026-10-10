/**
 * Single source of truth for published, indexable marketing pages.
 *
 * Only add a route once it renders useful public HTML with unique metadata.
 * Private workspace/auth routes, drafts and untranslated locales must NEVER
 * be included; the sitemap and GA4 public-page allowlist use this registry.
 */
export const publicPages = [
  {
    path: '/',
    title: 'RelayWA — WhatsApp API for Developers',
    description: 'Connect WhatsApp to your app with isolated sessions, REST API messaging, and real-time webhooks. Start a free 7-day RelayWA trial.',
    changeFrequency: 'weekly',
    priority: 1,
  },
  {
    path: '/pricing',
    title: 'RelayWA Pricing — WhatsApp Session API Plans',
    description: 'Explore RelayWA subscription plans and a 7-day trial for QR-linked WhatsApp sessions, REST messaging, and developer webhooks.',
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    path: '/api-docs',
    title: 'RelayWA API Docs — Sessions, Messages and Webhooks',
    description: 'Integrate RelayWA with REST API examples for QR sessions, messaging, webhooks, Laravel, JavaScript, Python, and .NET.',
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    path: '/help',
    title: 'RelayWA Help Center — WhatsApp API Questions',
    description: 'Find answers about RelayWA connections, API integration, message delivery, subscription plans, and developer troubleshooting.',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
] as const;

export function normalizePublicPath(pathname: string): string {
  const withoutQueryOrHash = pathname.split(/[?#]/, 1)[0] || '/';
  const cleaned = '/' + withoutQueryOrHash.replace(/^\/+|\/+$/g, '');
  return cleaned === '/' ? '/' : cleaned;
}

export function getPublicPage(pathname: string) {
  const path = normalizePublicPath(pathname);
  return publicPages.find((page) => page.path === path);
}

export function isIndexablePublicPath(pathname: string): boolean {
  return Boolean(getPublicPage(pathname));
}
