import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform dashboard includes infrastructure tenant and diagnostic views', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  for (const label of ['Clients','Sessions','Subscriptions','Infrastructure','Providers','Diagnostics']) {
    assert.match(source,new RegExp(label));
  }
  assert.match(source,/Worker leases/);
  assert.match(source,/Queue state/);
});
