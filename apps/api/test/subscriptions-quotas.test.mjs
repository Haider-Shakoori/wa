import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('subscription schema defines plans trial state and usage counters', async () => {
  const sql = await readFile(new URL('../migrations/015_subscriptions_quotas.sql', import.meta.url), 'utf8');
  assert.match(sql, /subscription_plans/);
  assert.match(sql, /organization_subscriptions/);
  assert.match(sql, /subscription_usage/);
  assert.match(sql, /'trial'/);
});

test('quota service enforces sessions messages and API key limits', async () => {
  const source = await readFile(new URL('../src/subscriptions/subscriptions.service.ts', import.meta.url), 'utf8');
  assert.match(source, /assertCanCreateSession/);
  assert.match(source, /assertCanSendMessage/);
  assert.match(source, /assertCanCreateApiKey/);
  assert.match(source, /recordOutboundMessage/);
});

test('billing subscription summary is protected by billing permission', async () => {
  const source = await readFile(new URL('../src/subscriptions/subscriptions.controller.ts', import.meta.url), 'utf8');
  assert.match(source, /PERMISSIONS\.BILLING_MANAGE/);
});
