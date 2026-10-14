// Cloudflare's narrowly scoped public SEO overlay.
// Does NOT replace the existing relaywa-web Worker, D1 bindings, API or platform.
// HTML snapshots are compiled from the corresponding Next.js pages in main.
const PAGES = __SEO_HTML_MAP__;
export const SEO_PATHS = [
  '/whatsapp-api-qr-code',
  '/whatsapp-webhooks',
  '/guides/whatsapp-web-vs-cloud-api',
];
export const SCRIPT_NAME = 'relaywa-seo-pages';
export const PROTECTED_SITEMAP_PATH = '/sitemap.xml';
function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
export function augmentSitemap(xml, hostname='relaywa.com') {
  if (!xml.includes('</urlset>') || !xml.includes('<urlset')) {
    throw new Error('Origin sitemap is not an XML urlset; no overlay applied.');
  }
  const additions = SEO_PATHS.filter(path => !xml.includes('<loc>https://' + hostname + path + '</loc>'))
    .map(path => '  <url><loc>' + escapeXml('https://' + hostname + path) + '</loc></url>')
    .join('\n');
  if (!additions) return xml;
  return xml.replace('</urlset>', additions + '\n</urlset>');
}
const responseHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-robots-tag': 'index, follow',
  'cache-control': 'public, max-age=300',
  'x-relaywa-seo-overlay': '1'
};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return fetch(request);
    const html = PAGES[url.pathname];
    if (html && (url.hostname === 'relaywa.com' || url.hostname.endsWith('.workers.dev'))) {
      return new Response(request.method === 'HEAD' ? null : html, {
        headers: responseHeaders
      });
    }
    if (url.pathname === PROTECTED_SITEMAP_PATH && url.hostname === 'relaywa.com') {
      // Cloudflare Workers Routes can fetch the existing Worker Custom Domain as origin.
      // Leave all original sitemap entries alone, adding only the approved new URLs.
      const original = await fetch(request);
      if (!original.ok) return original;
      const source = await original.text();
      let xml;
      try { xml = augmentSitemap(source, 'relaywa.com'); }
      catch { return new Response(source, original); }
      const headers = new Headers(original.headers);
      headers.set('content-type', 'application/xml; charset=utf-8');
      headers.set('cache-control', 'public, max-age=300');
      headers.set('x-relaywa-seo-overlay', '1');
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('etag');
      return new Response(request.method === 'HEAD' ? null : xml, {status: 200, headers});
    }
    // Route-scoped worker is never meant to serve the workspace, APIs, or unknown pages.
    return fetch(request);
  }
};
