import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../migrations/052_platform_diagnostic_archives_unique_index.sql', import.meta.url),
  'utf8',
);

test('diagnostic archive migration creates an upsert-compatible unique index', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(migration, /ON platform_diagnostic_archives \(resource_type, resource_id\)/);
  assert.match(migration, /Duplicate diagnostic archive resource pairs/);
  assert.match(migration, /to_regclass\('platform_diagnostic_archives'\)/);
});
