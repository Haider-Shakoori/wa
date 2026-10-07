import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/seo';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/pricing', '/api-docs', '/help'].map(path => ({ url: siteUrl + path }));
}
