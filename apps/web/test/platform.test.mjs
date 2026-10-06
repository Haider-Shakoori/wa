import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform dashboard includes worker queue tenant and diagnostic views', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  for (const label of ['Worker health','Queue health','Organizations','Recent errors']) {
    assert.match(source,new RegExp(label));
  }
});
