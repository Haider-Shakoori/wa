import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('dashboard uses Next.js 16', () => {
  assert.match(packageJson.dependencies.next, /^16\./);
});
