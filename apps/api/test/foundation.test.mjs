import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('API foundation uses NestJS 12', () => {
  assert.match(packageJson.dependencies['@nestjs/core'], /^12\./);
});
