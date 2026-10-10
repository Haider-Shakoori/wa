import type { MetadataRoute } from 'next';
import { publicPages } from '../lib/public-pages';
import { canonicalUrl } from '../lib/seo';

// Only registered, published public pages appear here. Future locale pages
// should be added to the registry only after review and with real hreflang.
export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((page) => ({
    url: canonicalUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
