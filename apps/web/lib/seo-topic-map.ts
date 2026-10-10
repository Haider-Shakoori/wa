/**
 * Canonical developer-intent navigation for the English-only public website.
 * Every href points into already-published /api-docs content; fragments are
 * navigation targets, never distinct sitemap entries or localized pages.
 */
export const developerTopics = [
  {
    id: 'quickstart',
    title: 'WhatsApp REST API quickstart',
    summary: 'Authenticate with a session-bound key and send your first message from your backend.',
    href: '/api-docs#quickstart',
  },
  {
    id: 'sessions',
    title: 'QR code and connected sessions',
    summary: 'Link an existing WhatsApp account, inspect QR pairing, and manage isolated session states.',
    href: '/api-docs#sessions',
  },
  {
    id: 'messages',
    title: 'Send text and media',
    summary: 'Read payload examples and understand transport acceptance versus recipient delivery.',
    href: '/api-docs#messages',
  },
  {
    id: 'webhooks',
    title: 'Signed webhooks and events',
    summary: 'Receive session and message events and validate the callback HMAC signature.',
    href: '/api-docs#webhooks',
  },
  {
    id: 'queue',
    title: 'Direct sending and retries',
    summary: 'Understand immediate dispatch and implement scheduling, pacing and send retries in your own app.',
    href: '/api-docs#queue',
  },
] as const;

export const commercialDocsLinks = {
  pricing: '/pricing',
  trial: '/register',
  documentation: '/api-docs',
} as const;
