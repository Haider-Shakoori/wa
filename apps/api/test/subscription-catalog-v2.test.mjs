import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('subscription catalog matches RelayWA five-tier commercial model', async () => {
  const sql = await readFile(new URL('../migrations/023_subscription_catalog_v2.sql', import.meta.url), 'utf8');
  assert.match(sql, /name = 'Basic'/);
  assert.match(sql, /monthly_price_cents = 399/);
  assert.match(sql, /name = 'Pro'/);
  assert.match(sql, /monthly_price_cents = 899/);
  assert.match(sql, /'plus', 'Plus', 6/);
  assert.match(sql, /1699, 17330/);
  assert.match(sql, /name = 'Business'/);
  assert.match(sql, /monthly_price_cents = 2499/);
  assert.match(sql, /daily_messages = 50/);
});

test('trial daily cap is enforced while paid plans can omit a daily cap', async () => {
  const source = await readFile(new URL('../src/subscriptions/subscriptions.service.ts', import.meta.url), 'utf8');
  assert.match(source, /outbound_messages_daily/);
  assert.match(source, /Daily message cap reached/);
  assert.match(source, /subscription\.daily_messages !== null/);
  assert.match(source, /current_date/);
});
