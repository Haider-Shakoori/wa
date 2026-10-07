import assert from 'node:assert/strict';

const base = process.env.SEO_CHECK_URL || 'http://localhost:3000';
const canonicalOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://relaywa.com').origin;
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200, `${path} must load successfully`);
  return { response, body: await response.text() };
}
const publicPaths = ['/', '/pricing', '/api-docs', '/help'];
const titles = new Set();
for (const path of publicPaths) {
  const { body } = await get(path);
  const title = body.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title?.includes('RelayWA'), `${path} must have a branded title`);
  assert.ok(!titles.has(title), `${path} must have a distinct title`);
  titles.add(title);
  assert.match(body, /<meta name="description" content="[^"]+"/);
  assert.match(body, /<meta name="viewport"/);
  const canonical = body.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(new URL(canonical).href, new URL(path, canonicalOrigin).href);
  assert.match(body, /property="og:image"/);
  assert.match(body, /name="twitter:card" content="summary_large_image"/);
  assert.equal((body.match(/<h1[ >]/g) || []).length, 1, `${path} must have one main heading`);
  console.log(`Public metadata: ${path} OK`);
}
for (const path of ['/dashboard', '/login', '/register', '/checkout', '/platform', '/docs']) {
  const { body } = await get(path);
  assert.match(body, /<meta name="robots" content="noindex/);
  console.log(`Noindex: ${path} OK`);
}
const { body: sitemap } = await get('/sitemap.xml');
assert.equal((sitemap.match(/<loc>/g) || []).length, publicPaths.length);
for (const path of publicPaths) assert.ok(sitemap.includes(canonicalOrigin + (path === '/' ? '' : path)));
const { body: robots } = await get('/robots.txt');
assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
for (const [path, type] of [['/favicon.ico', 'image/x-icon'], ['/opengraph-image', 'image/png'], ['/manifest.webmanifest', 'application/manifest+json']]) {
  const { response } = await get(path);
  assert.ok(response.headers.get('content-type')?.includes(type), `${path} must have the correct content type`);
}
const { body: home } = await get('/');
const structured = home.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
assert.ok(structured, 'Homepage must include structured data');
const schema = JSON.parse(structured);
assert.equal(schema['@context'], 'https://schema.org');
assert.ok(schema['@graph'].some(item => item['@type'] === 'WebSite'));
console.log('Sitemap, robots, favicon, social image, manifest, and structured data: OK');
