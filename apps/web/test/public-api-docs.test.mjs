import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public website links to RelayWA documentation and uses real API route shape', async () => {
  const source = await readFile(new URL('../components/relay-home.tsx', import.meta.url), 'utf8');
  assert.match(source, /href="\/api-docs"/);
  assert.match(source, /\/api\/v1\/sessions\/\{id\}\/messages\/text/);
  assert.match(source, /PRODUCT PREVIEW/);
  assert.doesNotMatch(source, /POST \/v1\/messages/);
});

test('public docs cover authentication sessions messages webhooks and safety', async () => {
  const source = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(source, /rw_live_/);
  assert.match(source, /rw_session_/);
  assert.match(source, /sessions\.read/);
  assert.match(source, /messages\.send/);
  assert.match(source, /messages\/image/);
  assert.match(source, /16 MB/);
  assert.match(source, /100 MB/);
  assert.match(source, /x-relaywa-signature/);
  assert.match(source, /timestamp \+ "\." \+ rawBody/);
  assert.match(source, /Safety Governor/);
});

test('tenant Developer center links to the complete public API docs', async () => {
  const source = await readFile(new URL('../components/developer-guide.tsx', import.meta.url), 'utf8');
  assert.match(source, /Open API documentation/);
  assert.match(source, /href="\/docs"/);
});

test('documentation styling is part of the unified RelayWA design system', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /RelayWA public developer documentation/);
  assert.match(css, /\.docs-layout/);
  assert.match(css, /\.docs-endpoints/);
  assert.match(css, /\.developer-docs-banner/);
});
