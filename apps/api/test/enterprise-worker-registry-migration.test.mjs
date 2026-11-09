import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../migrations/053_enterprise_worker_registry.sql', import.meta.url), 'utf8');

test('enterprise worker registry migration retains imported account references', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS enterprise_accounts_id_uidx ON enterprise_accounts\(id\)/);
  assert.match(migration, /REFERENCES enterprise_accounts\(id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS enterprise_workers/);
});

test('enterprise registration is automatic but provisioning is not started by a database trigger', () => {
  assert.match(migration, /AFTER INSERT ON enterprise_accounts/);
  assert.match(migration, /relaywa_register_enterprise_worker/);
  assert.match(migration, /'pending'/);
  assert.doesNotMatch(migration, /docker (run|start|create)/i);
});
