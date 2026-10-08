import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Platform Admin uses grouped operations navigation and includes Ops Assistant', async () => {
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  const bot = await readFile(new URL('../components/platform-support-bot.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

  assert.match(platform, /navigationGroups/);
  assert.match(platform, /Operations/);
  assert.match(platform, /Commercial/);
  assert.match(platform, /System/);
  assert.match(platform, /PlatformSupportBot/);
  assert.match(platform, /platform-hero-v2/);
  assert.match(bot, /RelayWA Ops Assistant/);
  assert.match(bot, /\/platform\/support\/ask/);
  assert.match(bot, /read-only diagnostics/);
  assert.match(css, /RelayWA Admin \+ Docs v7/);
  assert.match(css, /\.ops-bot-panel/);
});

test('developer portal is searchable and documents the actual RelayWA API surface', async () => {
  const docs = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');

  assert.match(docs, /Search endpoints, guides, and code/);
  assert.match(docs, /Sessions & QR/);
  assert.match(docs, /Send messages/);
  assert.match(docs, /Media & actions/);
  assert.match(docs, /Contacts, chats & groups/);
  assert.match(docs, /Direct sending & retries/);
  assert.match(docs, /Webhooks/);
  assert.match(docs, /Application responsibilities/);
  assert.match(docs, /Baileys vs Chromium/);
  assert.match(docs, /Troubleshooting/);
  assert.match(docs, /Production checklist/);

  assert.match(docs, /\/send-message/);
  assert.match(docs, /\/whatsapp-sessions\/:sessionId\/contacts/);
  assert.match(docs, /\/webhooks\/:endpointId\/deliveries/);
  assert.match(docs, /x-relaywa-signature/);
  assert.match(docs, /12025550123/);
});

test('light onboarding/admin contrast is explicitly protected', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.onboarding-header h1/);
  assert.match(css, /color:#182e36!important/);
  assert.match(css, /\.platform-shell\{/);
  assert.match(css, /--admin-text:#172830/);
});
