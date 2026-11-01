import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const worker = readFileSync(new URL('./fixtures/remote-store.js',import.meta.url),'utf8');
const routes = [...worker.matchAll(/this\.call\('([^']+)'/g)].map(m=>m[1]);
const required = ['/engine','/commands/claim','/commands/complete','/commands/fail','/sessions/recoverable','/sessions/recovered','/sessions/recovery-failed','/sessions/reconnect-attempts','/heartbeat','/sessions/heartbeat','/sessions/status','/sessions/qr','/sessions/event','/sessions/reconnect','/sessions/profile','/sessions/contact','/sessions/chat','/sessions/group','/sessions/profile-from-contact','/health-scan','/alerts/queue','/alerts/session/queue','/alerts/admins','/alerts/claim','/alerts/sent','/alerts/reschedule','/messages/claim','/messages/poll','/sessions/inbound','/messages/sent','/messages/failed','/webhooks/enqueue','/webhooks/claim-enqueued','/webhooks/claim','/webhooks/delivered','/webhooks/reschedule','/billing/claim','/billing/sent','/billing/failed'];
test('deployed worker remote bridge route inventory is complete',()=>{for(const route of required)assert.ok(routes.includes(route),route);});
test('remote bridge sends authenticated worker identity',()=>{assert.match(worker,/authorization: `Bearer \$\{this.secret\}`/);assert.match(worker,/workerId: this.workerId/);});
test('heartbeat coalescing requires explicit server acknowledgement',()=>{assert.match(worker,/x-relaywa-heartbeat-combined/);});
test('API controllers declare every remote worker route',()=>{
 const base=new URL('../src/worker-bridge/',import.meta.url);
 const files=['worker-bridge.controller.ts','worker-session.controller.ts','worker-directory.controller.ts','worker-messages.controller.ts','worker-webhooks.controller.ts','worker-alerts.controller.ts'];
 const handlers=files.flatMap(file=>[...readFileSync(new URL(file,base),'utf8').matchAll(/@Post\('([^']+)'\)/g)].map(m=>'/'+m[1]));
 for(const route of required)assert.ok(handlers.includes(route),'Missing API handler: '+route);
 assert.equal(new Set(handlers).size,handlers.length,'Duplicate worker route');
});
