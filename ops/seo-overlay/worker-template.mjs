// Cloudflare's narrowly scoped public SEO overlay.
// Does NOT replace the existing relaywa-web Worker, D1 bindings, API or platform.
// HTML snapshots are compiled from the corresponding Next.js pages in main.
const PAGES = __SEO_HTML_MAP__;
const COOKIE_JS = __COOKIE_JS__;
const COOKIE_CSS = __COOKIE_CSS__;
export const COOKIE_JS_PATH = '/relaywa-cookie-message.js';
export const COOKIE_CSS_PATH = '/relaywa-cookie-message.css';
export const MARKETING_ROUTES = [
  '/', '/pricing', '/api-docs', '/help', '/blog',
  '/blog/nodejs-whatsapp-api-send-webhooks',
  '/blog/laravel-whatsapp-api-order-notifications',
  '/blog/whatsapp-api-qr-session-troubleshooting',
];
// Only a known safe list of public HTML pages can receive the notice.
function cookieHead() {
  return '<link rel="stylesheet" href="' + COOKIE_CSS_PATH + '" data-relaywa-cookie="1"/>' +
    '<script defer src="' + COOKIE_JS_PATH + '" data-relaywa-cookie="1"></script>';
}
function cookieAssets(path, method) {
  const js = path === COOKIE_JS_PATH;
  return new Response(method === 'HEAD' ? null : js ? COOKIE_JS : COOKIE_CSS, {
    headers: {
      'content-type': js ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      'x-relaywa-cookie-assets': '1',
    },
  });
}
function applyNoticeToOrigin(original, method) {
  if (method === 'HEAD' || !original.ok ||
      !original.headers.get('content-type')?.toLowerCase().includes('text/html')) return original;
  // HTMLRewriter streams the existing Cloudflare app HTML without rebuilding,
  // replacing or modifying its D1 bindings, API, sessions or JavaScript.
  const rewritten = new HTMLRewriter().on('head', {
    element(element) { element.append(cookieHead(), {html:true}); },
  }).transform(original);
  const headers = new Headers(rewritten.headers);
  headers.set('x-relaywa-cookie-message', '1');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  return new Response(rewritten.body, {status:rewritten.status, statusText:rewritten.statusText, headers});
}
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
    if ([COOKIE_JS_PATH, COOKIE_CSS_PATH].includes(url.pathname)) {
      return cookieAssets(url.pathname, request.method);
    }
    const html = PAGES[url.pathname];
    if (html && (url.hostname === 'relaywa.com' || url.hostname.endsWith('.workers.dev'))) {
      const headers = {...responseHeaders};
      if (url.hostname.endsWith('.workers.dev')) headers['x-robots-tag'] = 'noindex, nofollow';
      return new Response(request.method === 'HEAD' ? null :
        html.replace('</head>', cookieHead() + '</head>'), {headers});
    }
    if (MARKETING_ROUTES.includes(url.pathname) &&
        (url.hostname === 'relaywa.com' || url.hostname.endsWith('.workers.dev'))) {
      // A stage preview at workers.dev forwards only known public URLs to the
      // existing relaywa-web custom domain. In production fetch(request)
      // resolves the custom domain's original Worker behind this exact route.
      const originRequest = url.hostname.endsWith('.workers.dev')
        ? new Request('https://relaywa.com' + url.pathname + url.search, request)
        : request;
      const original = await fetch(originRequest);
      return applyNoticeToOrigin(original, request.method);
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
