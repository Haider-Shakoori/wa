import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform console includes SaaS administration sections', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  for (const section of ['Organizations','Sessions','Subscriptions','Payments','Infrastructure','Providers','Diagnostics']) {
    assert.match(source,new RegExp(section));
  }
  assert.match(source,/approveManual/);
  assert.match(source,/toggleProvider/);
});
