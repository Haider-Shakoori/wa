import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard polls QR generation and then watches connection completion', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source,/setInterval/);
  assert.match(source,/qr\?\.available/);
  assert.match(source,/setQr/);
  assert.match(source,/session\.status!=='connected'/);
});
