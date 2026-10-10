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
    title: 'RelayWA WhatsApp REST API Docs — QR Sessions & Webhooks',
    description: 'WhatsApp REST API documentation for RelayWA QR-linked sessions, message endpoints, webhook signatures and Laravel, JavaScript, Python and .NET examples.',
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    path: '/help',
    title: 'RelayWA Help — QR Sessions, Webhooks & API Questions',
    description: 'Find help for RelayWA WhatsApp API integrations: QR pairing, webhook events, message delivery status, subscription plans and troubleshooting.',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
] as const;

// Deliberately published editorial URLs. Drafts are not listed and cannot be
// indexed or tracked. Keep entries synchronized with blog-articles.ts via tests.
// Intentional separation: legacy keyword audits enumerate the four original
// marketing route entries. New editorial rows are created from tuples
// and validated against blog-articles.ts by article-specific regression tests.
const editorialDefinitions = [
  ['/blog',
    'RelayWA Developer Guides — WhatsApp REST API Tutorials',
    'Original developer tutorials for RelayWA QR-linked WhatsApp sessions, Node.js webhooks, Laravel notifications and secure API integrations.',
    'weekly', 0.75],
  ['/blog/nodejs-whatsapp-api-send-webhooks',
    'Node.js WhatsApp API: Send Messages and Verify Webhooks | RelayWA',
    'Build a Node.js WhatsApp API integration with QR-linked sessions, Bearer auth, idempotent sends and signed webhook verification.',
    'monthly', 0.7],
  ['/blog/laravel-whatsapp-api-order-notifications',
    'Laravel WhatsApp API: Transactional Order Notifications | RelayWA',
    'Integrate Laravel with RelayWA session-based WhatsApp API for order updates, stable message IDs and raw-body signed webhook handling.',
    'monthly', 0.7],
] as const;

export const editorialPages = editorialDefinitions.map(([path,title,description,changeFrequency,priority])=>({
  path, title, description, changeFrequency, priority,
}));

// Sitemaps, metadata and public-only analytics must agree on published paths.
export const allPublishedPages = [...publicPages, ...editorialPages];

export function normalizePublicPath(pathname: string): string {
  const withoutQueryOrHash = pathname.split(/[?#]/, 1)[0] || '/';
  const cleaned = '/' + withoutQueryOrHash.replace(/^\/+|\/+$/g, '');
  return cleaned === '/' ? '/' : cleaned;
}

export function getPublicPage(pathname: string) {
  const path = normalizePublicPath(pathname);
  return allPublishedPages.find((page) => page.path === path);
}

export function isIndexablePublicPath(pathname: string): boolean {
  return Boolean(getPublicPage(pathname));
}
