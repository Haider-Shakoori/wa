import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../../ops/migration/audit-d1-temporal-columns.sql',import.meta.url),'utf8');
test('temporal schema audit is read only and covers date-like fields',()=>{
  assert.match(sql,/information_schema\.columns/);
  assert.match(sql,/current_schema\(\)/);
  assert.match(sql,/column_name LIKE '%_at'/);
  assert.doesNotMatch(sql,/\b(?:ALTER|UPDATE|DELETE|DROP|TRUNCATE)\s+(?:TABLE|FROM|\w)/i);
});
