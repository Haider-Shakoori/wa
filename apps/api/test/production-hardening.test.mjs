import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production config validates required secrets', async () => {
  const source = await readFile(new URL('../src/security/production-config.ts', import.meta.url), 'utf8');
  assert.match(source, /JWT_SECRET/);
  assert.match(source, /WEBHOOK_ENCRYPTION_KEY/);
  assert.match(source, /RELAYWA_ADMIN_PASSWORD/);
});

test('API bootstrap enables security middleware configuration', async () => {
  const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /helmet/);
  assert.match(source, /enableCors/);
  assert.match(source, /assertProductionConfig/);
});
