import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

function transpileModule(file) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const exports = {};
  runInNewContext(compiled.outputText, { exports }, { filename: file });
  return exports;
}

test('each commercial SEO topic points into existing, canonical documentation content', () => {
  const { developerTopics, commercialDocsLinks } = transpileModule('lib/seo-topic-map.ts');
  const docs = read('app/docs/page.tsx');
  const publicPages = read('lib/public-pages.ts');
  assert.equal(developerTopics.length, 5);
  assert.equal(new Set(developerTopics.map(topic => topic.id)).size, developerTopics.length);
  for (const topic of developerTopics) {
    assert.equal(topic.href, `/api-docs#${topic.id}`);
    assert.ok(docs.includes(`id="${topic.id}"`), `No real documentation topic ${topic.id}`);
    assert.ok(topic.title.length > 14);
    assert.ok(topic.summary.length > 55);
    assert.ok(!topic.href.startsWith('/features/'), 'do not publish a duplicate feature URL');
  }
  assert.equal(commercialDocsLinks.trial, '/register');
  assert.equal(commercialDocsLinks.pricing, '/pricing');
  assert.equal(commercialDocsLinks.documentation, '/api-docs');
  assert.deepEqual([...publicPages.matchAll(/path: '(\/[^']*)'/g)].map(match => match[1]),
    ['/', '/pricing', '/api-docs', '/help']);
});

test('existing English homepage, help, pricing and docs reuse linked topics without new pages', () => {
  const home = read('components/relay-home.tsx');
  const pricing = read('app/pricing/page.tsx');
  const help = read('app/help/page.tsx');
  const docs = read('app/docs/page.tsx');
  assert.match(home, /developerTopics\.map/);
  assert.match(pricing, /pricingGuideTopics\.map/);
  assert.match(help, /developerTopics\.filter/);
  assert.match(docs, /developerTopics\.map/);
  assert.match(docs, /href=\{'#'\+topic\.id\}/);
  assert.match(docs, /href="\/register">Start 7-day trial/);
  assert.match(home, /href="\/api-docs#sessions"/);
  assert.match(pricing, /href=\{topic\.href\}/);
  assert.match(help, /href=\{topic\.href\}/);
  assert.doesNotMatch(home + pricing + help, /href="\/features\//);
});

test('marketing copy accurately identifies QR-linked WhatsApp Web and immediate outbound dispatch', () => {
  const home=read('components/relay-home.tsx');
  const pricing=read('app/pricing/page.tsx');
  const docs=read('app/docs/page.tsx');
  const merged=home+pricing+docs;
  assert.match(home, /not Meta's official WhatsApp Cloud API/);
  assert.match(docs, /not Meta's official WhatsApp Cloud API/);
  assert.match(docs, /There is no outbound Redis queue, randomized gap, or automatic retry/);
  assert.match(home, /Your application should handle schedules, pacing and bounded retries/);
  assert.match(home, /clientMessageId/);
  assert.match(pricing, /sending schedules and automatic outbound retries are managed by your own application/);
  assert.doesNotMatch(merged, /\/features\/message-queue/);
  assert.doesNotMatch(home, /Save 14%/);
  assert.doesNotMatch(home, /123 Example Street|Springfield, IL 62701|Temporary address/);
});

test('documentation metadata and intent are unique to existing canonical pages', () => {
  const registry=read('lib/public-pages.ts');
  assert.match(registry, /WhatsApp REST API Docs/);
  assert.match(registry, /WhatsApp API integrations: QR pairing/);
  const docs=read('app/docs/page.tsx');
  assert.match(docs, /<h1>WhatsApp REST API documentation:/);
  assert.match(docs, /aria-label="Popular WhatsApp API guides"/);
  assert.match(docs, /href="\/pricing"/);
  assert.match(read('app/api-docs/page.tsx'), /marketingPageMetadata\('\/api-docs'\)/);
  assert.match(read('app/pricing/page.tsx'), /marketingPageMetadata\('\/pricing'\)/);
  assert.match(read('app/help/page.tsx'), /marketingPageMetadata\('\/help'\)/);
  assert.match(read('app/layout.tsx'), /<html lang="en"/);
  assert.match(read('components/google-analytics.tsx'), /isIndexablePublicPath/);
});

test('production CI smoke checks all HTML topic links and registered docs anchors', () => {
  const smoke=readFileSync(new URL('../../../scripts/seo-perf-budget.mjs',import.meta.url),'utf8');
  assert.match(smoke, /const docAnchors = \['quickstart', 'sessions', 'messages', 'webhooks', 'queue'\]/);
  assert.match(smoke, /href="\/api-docs#/);
  assert.match(smoke, /href="\/register"/);
  assert.match(smoke, /noindex/);
  assert.match(smoke, /maxJavascriptGzipBytes/);
  assert.match(smoke, /maxCssGzipBytes/);
});
