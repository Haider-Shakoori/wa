import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('customer portal includes onboarding, live send and message history', async () => {
  const dashboard = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  const ops = await readFile(new URL('../components/customer-operations.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /Build your integration/);
  assert.match(dashboard, /QuickSend/);
  assert.match(dashboard, /MessageHistory/);
  assert.match(ops, /clientMessageId/);
  assert.match(ops, /\/whatsapp-sessions/);
  assert.match(ops, /\/messages'/);
});

test('customer portal exposes session restart and logout controls', async () => {
  const dashboard = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /lifecycle/);
  assert.match(dashboard, /Restart/);
  assert.match(dashboard, /Disconnect/);
});

test('platform console supports client search and subscription editor', async () => {
  const source = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Search clients, numbers, plans/);
  assert.match(source, /sessionControl/);
  assert.match(source, /updateSubscription/);
  assert.match(source, /\+7 days/);
});
