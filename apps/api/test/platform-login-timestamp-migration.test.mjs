import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../migrations/049_platform_login_events_timestamp_compatibility.sql', import.meta.url),'utf8');
test('D1 login event timestamps are converted to timestamptz',()=>{
  assert.match(migration,/ALTER COLUMN created_at TYPE timestamptz/);
  assert.match(migration,/AT TIME ZONE 'UTC'/);
  assert.match(migration,/ALTER COLUMN created_at SET DEFAULT now\(\)/);
  assert.match(migration,/contains invalid D1 timestamps/);
});
