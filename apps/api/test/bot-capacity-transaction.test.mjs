import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/bots/bots.service.ts',import.meta.url),'utf8');
const create=code.slice(code.indexOf('  async create(org:'),code.indexOf('  async get(org:'));
test('bot creation locks organization before capacity check and insert',()=>{
 assert.match(create,/this.db.transaction\(async client/);
 const lock=create.indexOf('FOR UPDATE');
 const count=create.indexOf('SELECT count(*)::int');
 const insert=create.indexOf('INSERT INTO relaywa_bots');
 assert.ok(lock>=0&&lock<count&&count<insert);
});
test('bot creation checks entitlement expiry in SQL under lock',()=>{
 assert.match(create,/status='active' AND current_period_end>now\(\)/);
 assert.match(create,/status='trialing' AND trial_ends_at>now\(\)/);
 assert.match(create,/Bot Builder subscription required/);
 assert.match(create,/Bot plan limit reached/);
});
test('bot creation is standby only and tenant-scoped',()=>{
 assert.match(create,/WHERE id=\$1 AND organization_id=\$2 AND deleted_at IS NULL/);
 assert.match(create,/VALUES\(\$1,\$2,\$3,\$4,\$5,'standby'\)/);
});
