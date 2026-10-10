import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

function loadTypescript(path, modules = {}, environment = {}) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
    reportDiagnostics: true,
  });
  const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Transpile errors in ${path}`);
  const exports = {};
  const context = {
    exports,
    URL,
    process: { env: environment },
    require: (id) => {
      assert.ok(id in modules, `Unexpected import ${id} from ${path}`);
      return modules[id];
    },
  };
  runInNewContext(compiled.outputText, context, { filename: path });
  return exports;
}

const registry = loadTypescript('lib/public-pages.ts');
const seo = loadTypescript('lib/seo.ts', { './public-pages': registry }, {
  NEXT_PUBLIC_SITE_URL: 'https://relaywa.com/ignored-path/',
});
const sitemap = loadTypescript('app/sitemap.ts', {
  '../lib/public-pages': registry,
  '../lib/seo': seo,
}).default;
const robots = loadTypescript('app/robots.ts', { '../lib/seo': seo }).default;

test('only four approved public pages are indexable, with normalized paths', () => {
  assert.deepEqual(Array.from(registry.publicPages, (x) => x.path),
    ['/', '/pricing', '/api-docs', '/help']);
  assert.equal(registry.isIndexablePublicPath('/pricing/'), true);
  assert.equal(registry.isIndexablePublicPath('/pricing?utm_campaign=x'), true);
  for (const route of ['/login', '/register', '/dashboard', '/checkout', '/subscription',
    '/settings', '/whatsapp', '/platform', '/docs', '/api/private', '/admin']) {
    assert.equal(registry.isIndexablePublicPath(route), false, route);
  }
  assert.equal(new Set(registry.publicPages.map(p => p.title)).size, 4);
  assert.equal(new Set(registry.publicPages.map(p => p.description)).size, 4);
});

test('canonical URLs are HTTPS, normalized, and have no queries or fragments', () => {
  assert.equal(seo.siteUrl, 'https://relaywa.com');
  assert.equal(seo.canonicalUrl('/'), 'https://relaywa.com/');
  assert.equal(seo.canonicalUrl('/pricing/?utm_source=abc#detail'), 'https://relaywa.com/pricing');
  assert.equal(seo.canonicalUrl('api-docs/'), 'https://relaywa.com/api-docs');
  assert.equal(seo.marketingPageMetadata('/help').alternates.canonical, 'https://relaywa.com/help');
  assert.equal(seo.marketingPageMetadata('/').title.absolute, 'RelayWA — WhatsApp API for Developers');
  assert.throws(() => seo.marketingPageMetadata('/dashboard'), /Unknown or unpublished/);
});

test('sitemap is registry-driven without private routes, query strings, or unapproved locales', () => {
  const rows = sitemap();
  assert.equal(rows.length, registry.publicPages.length);
  assert.deepEqual(Array.from(rows, row => row.url), registry.publicPages.map(page => seo.canonicalUrl(page.path)));
  for (const row of rows) {
    assert.match(row.url, /^https:\/\/relaywa\.com\//);
    assert.ok(!/[?#]/.test(row.url));
    assert.ok(row.priority >= 0 && row.priority <= 1);
  }
  registry.publicPages.push({ path:'/approved-test',title:'Test',description:'Test content',changeFrequency:'weekly',priority:0.2 });
  try {
    assert.equal(sitemap().at(-1).url, 'https://relaywa.com/approved-test');
  } finally { registry.publicPages.pop(); }
});

test('robots references canonical sitemap and leaves document crawling possible to see noindex', () => {
  const result = robots();
  assert.equal(result.sitemap, 'https://relaywa.com/sitemap.xml');
  assert.equal(result.host, 'https://relaywa.com');
  assert.equal(result.rules.allow, '/');
  assert.ok(result.rules.disallow.includes('/api/'));
  assert.ok(!result.rules.disallow.includes('/dashboard'));
});

test('every approved route exports route-specific registry metadata', () => {
  const pages = [
    ['app/page.tsx', '/'],
    ['app/pricing/page.tsx', '/pricing'],
    ['app/api-docs/page.tsx', '/api-docs'],
    ['app/help/page.tsx', '/help'],
  ];
  for (const [file, path] of pages) {
    assert.ok(read(file).includes(`marketingPageMetadata('${path}')`), `${file} metadata`);
  }
  const tracker = read('components/google-analytics.tsx');
  assert.match(tracker, /isIndexablePublicPath\(normalizedPath\)/);
  assert.ok(!tracker.includes('trackedPublicPaths'));
});

test('existing analytics proxy still runs but prevents index and collection on private paths', () => {
  const proxy = loadTypescript('proxy.ts', {
    'node:crypto': { createHmac: () => { throw new Error('Private route should not collect'); } },
    'node:net': { isIP: () => 0 },
    'next/server': { NextResponse: { next: () => ({ headers: new Map() }) } },
    './lib/public-pages': registry,
  });
  const fake = (pathname) => ({
    method: 'GET',
    nextUrl: { pathname, hostname: 'relaywa.com' },
    headers: new Headers({ accept: 'text/html', 'user-agent': 'Googlebot' }),
    cookies: { get: () => undefined },
  });
  const event = { waitUntil: () => { throw new Error('Unexpected tracking request'); } };
  const response = proxy.proxy(fake('/dashboard'), event);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(proxy.proxy(fake('/pricing'), event).headers.get('X-Robots-Tag'), undefined);
  assert.match(read('proxy.ts'), /isIndexablePublicPath\(path\)/);
  assert.match(read('proxy.ts'), /WEBSITE_ANALYTICS_INGEST_KEY/);
});

test('legacy docs redirect is one way, and 404 page is nonindexable', async () => {
  const config = loadTypescript('next.config.ts').default;
  const redirects = await config.redirects();
  assert.ok(redirects.some(x => x.source === '/docs' && x.destination === '/api-docs' && x.permanent));
  assert.ok(!redirects.some(x => x.source === '/api-docs' && x.destination === '/docs'));
  assert.match(read('app/not-found.tsx'), /index:\s*false/);
});
