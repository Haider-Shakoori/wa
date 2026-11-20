import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const controller=read('../src/bots/bots.controller.ts');
const service=read('../src/bots/bots.service.ts');
const page=read('../../web/app/platform/page.tsx');
test('platform Bot Builder subscriptions require platform admin guard',()=>{
 assert.match(controller,/@Controller\('platform\/bot-subscriptions'\)/);
 assert.match(controller,/@UseGuards\(JwtAuthGuard,PlatformAdminGuard\)/);
});
test('platform page contains read-only bot subscriptions',()=>{
 assert.match(page,/Bot subscriptions/);
 assert.match(service,/LIMIT 200/);
 assert.match(service,/COUNT\(b.id\)::int AS bot_count/);
});
