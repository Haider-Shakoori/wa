import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=n=>readFileSync(new URL(`../migrations/${n}`,import.meta.url),'utf8');
test('auth temporal migration preserves timezone offsets and refuses invalid data',()=>{
 const s=sql('050_d1_auth_temporal_compatibility.sql');
 assert.match(s,/Invalid timestamps/);
 assert.match(s,/::timestamptz/);
 assert.match(s,/AT TIME ZONE %L/);
 assert.match(s,/ALTER COLUMN %I TYPE timestamptz/);
});
test('remaining temporal migration validates all targets before conversion',()=>{
 const s=sql('051_normalize_remaining_d1_temporal_columns.sql');
 assert.match(s,/Unparseable timestamp/);
 assert.match(s,/::timestamptz/);
 assert.match(s,/AT TIME ZONE %L/);
 assert.ok(s.indexOf('IF invalid_count > 0') < s.indexOf('ALTER TABLE %I'));
});
