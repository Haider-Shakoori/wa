import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root=new URL('../src/worker-bridge/',import.meta.url);
const auth=readFileSync(new URL('shared-worker-authorization.ts',root),'utf8');
const bridge=readFileSync(new URL('worker-bridge.controller.ts',root),'utf8');
test('legacy shared credentials cannot impersonate registered enterprise workers',()=>{
 assert.match(auth,/FROM enterprise_workers WHERE worker_id=\$1/);
 assert.match(auth,/if \(result\.rowCount\) throw new ForbiddenException\(\)/);
 assert.match(auth,/timingSafeEqual/);
});
test('all bridge handlers invoke enterprise identity gate',()=>{
 const handlers=[...bridge.matchAll(/@Post\('/g)].length;
 const gates=[...bridge.matchAll(/await authorizeSharedWorker\(/g)].length;
 assert.equal(gates,handlers);
});
