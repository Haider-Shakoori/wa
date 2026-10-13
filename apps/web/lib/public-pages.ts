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
    title: 'WhatsApp API for Developers — QR Sessions & Webhooks | RelayWA',
    description: 'Connect your WhatsApp number by QR code, send messages through a REST API, manage multiple sessions and receive signed webhooks with RelayWA.',
    changeFrequency: 'weekly',
    priority: 1,
  },
  {
    path: '/pricing',
    title: 'WhatsApp API Pricing & Cost — QR Session Plans | RelayWA',
    description: 'Compare RelayWA WhatsApp API pricing: monthly and annual plans for QR-linked sessions, REST messaging, signed webhooks and a 7-day trial.',
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    path: '/api-docs',
    title: 'WhatsApp REST API Documentation & Integration | RelayWA',
    description: 'WhatsApp REST API docs for sending messages, QR-linked sessions, API keys and signed webhooks. HTTP integration examples for Node.js, Laravel, Python and .NET.',
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
  ['/blog/whatsapp-api-qr-session-troubleshooting',
    'WhatsApp API QR Code and Session Troubleshooting Guide | RelayWA',
    'Diagnose QR pairing, expired codes, disconnected sessions and reconnecting WhatsApp Web APIs using verified RelayWA session states and read-only checks.',
    'monthly', 0.7],
] as const;

export const editorialPages = editorialDefinitions.map(([path,title,description,changeFrequency,priority])=>({
  path, title, description, changeFrequency, priority,
}));

// Distinct buyer and integration search intents. Keep vendor comparisons gated
// until independently verified; these routes describe supported product behavior.
// Keep new approved intent routes in tuple form, matching editorial definitions.
// Historic keyword research audits intentionally read only the four original
// \`path: '...'\` marketing entries and must not confuse these routes with
// unverified country-page or translated-keyword publishing approvals.
const intentDefinitions = [
  ['/whatsapp-api-qr-code',
    'WhatsApp API with QR Code | Connect Your Number — RelayWA',
    'Learn to link a WhatsApp number through a QR code, inspect session state and call RelayWA REST endpoints. Unofficial WhatsApp Web integration.',
    'monthly', 0.8],
  ['/whatsapp-webhooks',
    'WhatsApp API Webhooks | Signed Events & Examples — RelayWA',
    'Understand RelayWA WhatsApp message and session webhooks, HMAC-SHA256 signature validation, event deduplication and integration failure handling.',
    'monthly', 0.8],
  ['/guides/whatsapp-web-vs-cloud-api',
    'WhatsApp Web API vs Official Cloud API | Key Differences',
    'Compare QR-linked WhatsApp Web integrations and Meta’s official WhatsApp Cloud API by connection method, authorization, restrictions and operating risks.',
    'monthly', 0.65],
] as const;

export const intentPages = intentDefinitions.map(([path,title,description,changeFrequency,priority])=>({
  path,title,description,changeFrequency,priority,
}));

// Sitemaps, metadata and public-only analytics must agree on published paths.
export const allPublishedPages = [...publicPages, ...editorialPages, ...intentPages];

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
