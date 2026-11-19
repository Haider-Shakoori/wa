import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const schema=read('../migrations/056_relaywa_bots_standby.sql');
const service=read('../src/bots/bots.service.ts');
const controller=read('../src/bots/bots.controller.ts');
test('bots are restricted to standby at database level',()=>{
 assert.match(schema,/mode='standby'/);
 assert.match(service,/VALUES\(\$1,\$2,\$3,\$4,\$5,'standby'\)/);
});
test('FAQ rows use composite tenant foreign key',()=>{
 assert.match(schema,/FOREIGN KEY\(bot_id,organization_id\)/);
});
test('all bot reads and mutations are organization scoped',()=>{
 assert.match(service,/WHERE id=\$1 AND organization_id=\$2/);
 assert.match(service,/WHERE bot_id=\$1 AND organization_id=\$2/);
 assert.match(service,/WHERE id=\$1 AND bot_id=\$2 AND organization_id=\$3/);
});
test('dashboard endpoints require authentication and permissions',()=>{
 assert.match(controller,/@UseGuards\(JwtAuthGuard, PermissionGuard\)/);
 assert.match(controller,/@RequirePermissions\(PERMISSIONS.SESSIONS_MANAGE\)/);
});
test('new management API cannot activate or send messages',()=>{
 assert.doesNotMatch(controller,/@(?:Patch|Put)\(/);
 assert.doesNotMatch(controller, /sendMessage|dispatch|activate|connectSession/);
});
