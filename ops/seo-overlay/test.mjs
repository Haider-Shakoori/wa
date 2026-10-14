import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {augmentSitemap, SEO_PATHS, SCRIPT_NAME} from './dist/index.mjs';

test('overlay has exactly three fixed public pages and never intercepts other app paths', async () => {
  assert.equal(SCRIPT_NAME, 'relaywa-seo-pages');
  assert.equal(SEO_PATHS.length, 3);
  const seen = new Set();
  for (const path of SEO_PATHS) {
    assert.ok(!seen.has(path));
    seen.add(path);
    const res = await worker.fetch(new Request('https://relaywa.com' + path));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('x-robots-tag'), /index/);
    const html = await res.text();
    assert.ok(html.includes('https://relaywa.com' + path));
    assert.match(html, /<h1(?:\s|>)/i);
    assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1);
    assert.ok(html.includes('application/ld+json'));
    assert.match(html, /<style\b/i, 'Worker page must be styled without external build assets');
    assert.ok(!html.includes('self.__next_f'), 'No client hydration chunk references');
    assert.doesNotMatch(html, /we guarantee delivery|ban.proof|relaywa is (?:an )?official meta/i);
  }
  for (const route of ['/api/auth/me', '/dashboard', '/login', '/pricing', '/robots.txt']) {
    assert.ok(!SEO_PATHS.includes(route));
  }
});

test('sitemap overlay augments real sitemap and deduplicates future origin updates', () => {
  const origin = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://relaywa.com/</loc></url><url><loc>https://relaywa.com/pricing</loc></url></urlset>';
  const result = augmentSitemap(origin);
  assert.match(result, /<urlset/);
  assert.ok(result.includes('https://relaywa.com/pricing'));
  for (const path of SEO_PATHS) {
    const loc = 'https://relaywa.com' + path;
    assert.equal(result.split('<loc>' + loc + '</loc>').length - 1, 1, 'Exactly one of: ' + loc);
  }
  const twice = augmentSitemap(result);
  assert.equal(twice, result);
  assert.throws(() => augmentSitemap('not a sitemap'), /not an XML urlset/);
});
