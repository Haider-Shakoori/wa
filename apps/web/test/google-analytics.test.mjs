import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('GA4 is mounted once and uses the provided RelayWA measurement ID', async () => {
  const layout = await read('../app/layout.tsx');
  const tracker = await read('../components/google-analytics.tsx');

  assert.match(layout, /import GoogleAnalytics from '..\/components\/google-analytics'/);
  assert.match(layout, /<GoogleAnalytics\/>/);
  assert.match(tracker, /G-61Z26DFM1V/);
  assert.match(tracker, /googletagmanager\.com\/gtag\/js/);
  assert.match(tracker, /strategy="afterInteractive"/);
});

test('GA4 only reports selected public pages, without private URL query data', async () => {
  const tracker = await read('../components/google-analytics.tsx');
  // Read approved public routes from the shared sitemap/GA4 registry.
  const registry = await read('../lib/public-pages.ts');
  assert.match(tracker, /isIndexablePublicPath/);
  assert.doesNotMatch(tracker, /trackedPublicPaths/);
  assert.ok(registry.includes("path: '/pricing'"));
  assert.ok(registry.includes("path: '/api-docs'"));
  assert.ok(registry.includes("path: '/help'"));
  assert.match(tracker, /if \(!isPublic\) return null/);
  assert.match(tracker, /ga-disable-/);
  assert.match(tracker, /send_page_view: false/);
  assert.match(tracker, /window\.location\.origin \+ normalizedPath/);
  assert.doesNotMatch(tracker, /window\.location\.search|useSearchParams|document\.cookie|localStorage/);
});
