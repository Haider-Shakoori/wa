import type { Metadata } from 'next';
import { getPublicPage } from './public-pages';

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://relaywa.com').origin;
export const siteDescription = 'Connect WhatsApp numbers to your applications with RelayWA. Send messages through a REST API, receive webhooks, and manage isolated sessions.';

export function canonicalUrl(path: string): string {
  // Normalize root/trailing slashes and avoid accidentally using query strings
  // or fragments as a canonical or sitemap location.
  const pathname = '/' + (path.split(/[?#]/, 1)[0] || '').replace(/^\/+|\/+$/g, '');
  return new URL(pathname, siteUrl).toString();
}

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = canonicalUrl(path);
  return {
    // An absolute title prevents the root layout's "| RelayWA" template from
    // duplicating the brand in titles that already contain "RelayWA".
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website', siteName: 'RelayWA', locale: 'en_US',
      url, title, description,
      images: [{ url: canonicalUrl('/opengraph-image'), width: 1200, height: 630, alt: 'RelayWA WhatsApp API for developers' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [canonicalUrl('/opengraph-image')] },
  };
}

export function marketingPageMetadata(path: string): Metadata {
  const page = getPublicPage(path);
  if (!page) throw new Error(`Unknown or unpublished SEO route: ${path}`);
  return publicMetadata(page.title, page.description, page.path);
}
