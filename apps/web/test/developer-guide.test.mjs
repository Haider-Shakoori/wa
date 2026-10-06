import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('developer guide can create API keys and provides common language examples', async () => {
  const source = await readFile(new URL('../components/developer-guide.tsx', import.meta.url), 'utf8');
  assert.match(source, /\/v1\/api-keys/);
  assert.match(source, /messages\.send/);
  for (const language of ['Laravel \/ PHP','Node\.js','Python','C# \/ \.NET','Java','Go','cURL']) {
    assert.match(source, new RegExp(language));
  }
});

test('developer guide uses selected live session id in message endpoint', async () => {
  const source = await readFile(new URL('../components/developer-guide.tsx', import.meta.url), 'utf8');
  assert.match(source, /effectiveSessionId/);
  assert.match(source, /\/messages\/text/);
  assert.match(source, /clientMessageId/);
});
