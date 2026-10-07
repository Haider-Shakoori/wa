import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Platform Admin shares the tenant workspace shell and includes Ops Assistant', async () => {
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  const bot = await readFile(new URL('../components/platform-support-bot.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/platform-tenant.css', import.meta.url), 'utf8');

  assert.match(platform, /navigationGroups/);
  assert.match(platform, /Operations/);
  assert.match(platform, /Commercial/);
  assert.match(platform, /System/);
  assert.match(platform, /PlatformSupportBot/);
  assert.match(platform, /rw-app rw-platform-app/);
  assert.match(platform, /rw-sidebar rw-platform-sidebar/);
  assert.match(platform, /rw-topbar/);
  assert.match(platform, /rw-body rw-platform-body/);
  assert.match(platform, /rw-dashboard-welcome rw-platform-welcome/);
  assert.doesNotMatch(platform, /app-shell platform-shell/);
  assert.match(bot, /RelayWA Ops Assistant/);
  assert.match(bot, /\/v1\/platform\/support\/ask/);
  assert.match(bot, /read-only diagnostics/);
  assert.match(css, /Platform Admin deliberately reuses the tenant workspace visual language/);
  assert.match(css, /\.rw-platform-app/);
  assert.match(css, /\.rw-platform-app \.ops-bot-panel/);
});

test('developer portal is searchable and documents the actual RelayWA API surface', async () => {
  const docs = await readFile(new URL('../app/docs/page.tsx', import.meta.url), 'utf8');

  assert.match(docs, /Search documentation/);
  assert.match(docs, /Sessions & QR lifecycle/);
  assert.match(docs, /Send messages/);
  assert.match(docs, /Media & actions/);
  assert.match(docs, /Contacts, chats & groups/);
  assert.match(docs, /Queue, scheduling, retries & idempotency/);
  assert.match(docs, /Webhooks/);
  assert.match(docs, /Safety Governor/);
  assert.match(docs, /Baileys vs Chromium/);
  assert.match(docs, /Troubleshooting/);
  assert.match(docs, /Production checklist/);

  assert.match(docs, /\/v1\/sessions\/:sessionId\/messages\/text/);
  assert.match(docs, /\/v1\/sessions\/:sessionId\/contacts/);
  assert.match(docs, /\/v1\/webhooks\/:endpointId\/deliveries/);
  assert.match(docs, /x-relaywa-signature/);
  assert.match(docs, /E164_RECIPIENT_NUMBER/);
});

test('light onboarding/admin contrast is explicitly protected', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.onboarding-header h1/);
  assert.match(css, /color:#182e36!important/);
  assert.match(css, /\.platform-shell\{/);
  assert.match(css, /--admin-text:#172830/);
});
