import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('dashboard polls QR generation and surfaces timeout errors', async () => {
  const source = await readFile(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /for \(let attempt = 0; attempt < 20;/);
  assert.match(source, /value\.available && value\.dataUrl/);
  assert.match(source, /QR generation is taking longer than expected/);
});
