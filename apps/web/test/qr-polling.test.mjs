import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard polls QR generation and then watches connection completion', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source,/attempt<20/);
  assert.match(source,/value\.available && value\.dataUrl/);
  assert.match(source,/watchConnectedSession/);
  assert.match(source,/QR generation is taking longer than expected/);
});
