import type { MetadataRoute } from 'next';
import { canonicalUrl, siteUrl } from '../lib/seo';

// Do not disallow private HTML routes: bots must be able to see the HTTP
// X-Robots-Tag: noindex header emitted by the existing Next.js proxy.
// Authorization remains the only security boundary for private data.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: canonicalUrl('/sitemap.xml'),
    host: siteUrl,
  };
}
