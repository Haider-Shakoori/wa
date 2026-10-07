import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worker routes session operations by the persisted session engine', async () => {
  const router = await readFile(new URL('../src/messaging-session-manager.js', import.meta.url), 'utf8');
  const chromium = await readFile(new URL('../src/chromium-session.js', import.meta.url), 'utf8');
  const index = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(router, /getSessionEngine/);
  assert.match(router, /'baileys'/);
  assert.match(router, /'chromium'/);
  assert.match(chromium, /LocalAuth/);
  assert.match(chromium, /new Client/);
  assert.match(chromium, /CHROMIUM_MAX_SESSIONS_PER_WORKER/);
  assert.match(index, /MessagingSessionManager/);
  assert.equal(pkg.dependencies['whatsapp-web.js'], '1.34.7');
});


test('Chromium dependency stack loads under the worker Node runtime', async () => {
  const module = await import('whatsapp-web.js');
  const WhatsAppWeb = module.default ?? module;
  assert.equal(typeof WhatsAppWeb.Client, 'function');
  assert.equal(typeof WhatsAppWeb.LocalAuth, 'function');
  assert.equal(typeof WhatsAppWeb.MessageMedia, 'function');
});
