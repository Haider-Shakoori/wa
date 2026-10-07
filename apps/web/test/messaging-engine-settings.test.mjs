import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('platform UI can select Baileys or Chromium as the default engine', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Messaging/);
  assert.match(source, /Baileys/);
  assert.match(source, /Chromium \/ WhatsApp Web/);
  assert.match(source, /Save messaging engine/);
  assert.match(source, /settings\/messaging-engine/);
  assert.match(source, /Existing sessions keep their current engine/);
});
