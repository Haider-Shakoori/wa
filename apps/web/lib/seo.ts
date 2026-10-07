import type { Metadata } from 'next';
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://relaywa.com').origin;
export const siteDescription = 'Connect WhatsApp numbers to your applications with RelayWA. Send messages through a REST API, receive webhooks, and manage isolated sessions.';
export function publicMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: siteUrl + path },
    openGraph: { type: 'website', siteName: 'RelayWA', locale: 'en_US', url: siteUrl + path, title, description,
      images: [{ url: siteUrl + '/opengraph-image', width: 1200, height: 630, alt: 'RelayWA WhatsApp API for developers' }] },
    twitter: { card: 'summary_large_image', title, description, images: [siteUrl + '/opengraph-image'] } };
}
