import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser-facing RelayWA sources contain no localhost API URLs', async () => {
  const files = [
    '../lib/api.ts',
    '../lib/integration-examples.ts',
    '../app/docs/page.tsx',
  ];
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /http:\/\/(localhost|127\.0\.0\.1):\d+/);
  }
});

test('production-facing examples use RelayWA public API or same-origin API fallback', async () => {
  const api = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');
  const examples = await readFile(new URL('../lib/integration-examples.ts', import.meta.url), 'utf8');
  const docs = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');
  assert.match(api, /NEXT_PUBLIC_API_BASE_URL \?\? '\/api'/);
  assert.match(examples, /https:\/\/api\.relaywa\.com\/api\/send-message/);
  assert.match(docs, /https:\/\/api\.relaywa\.com\/api/);
});
