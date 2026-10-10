import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser-facing API sources never embed localhost production endpoints', async () => {
  const files = [
    '../lib/api.ts',
    '../lib/integration-examples.ts',
    '../app/docs/page.tsx',
  ];

  for (const relative of files) {
    const source = await readFile(new URL(relative, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /http:\/\/localhost:3001\/api/);
  }

  const api = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');
  const docs = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');
  const examples = await readFile(new URL('../lib/integration-examples.ts', import.meta.url), 'utf8');

  assert.match(api, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(api, /\?\? '\/api'/);
  assert.match(docs, /import \{ integrationExamples, exampleApiBase \}/);
  assert.match(docs, /const endpoint = exampleApiBase/);
  assert.match(examples, /NEXT_PUBLIC_SITE_URL/);
  assert.match(examples, /exampleApiBase/);
  assert.match(examples, /https:\/\/relaywa\.com/);
});
