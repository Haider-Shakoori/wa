import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base=new URL('../src/worker-bridge/',import.meta.url);
const bridge=readFileSync(new URL('worker-bridge.controller.ts',base),'utf8');
const sessions=readFileSync(new URL('worker-session.controller.ts',base),'utf8');
for(const [name,source] of [['commands',bridge],['recovery',sessions]]) {
 test(name+' claims are scoped to ready enterprise workers and exclude dedicated organizations from shared workers',()=>{
  assert.match(source,/FROM enterprise_workers ew WHERE ew\.worker_id=\$\d+ AND ew\.status='ready' AND ew\.organization_id=/);
  assert.match(source,/NOT EXISTS \(SELECT 1 FROM enterprise_workers ew WHERE ew\.worker_id=\$\d+\)/);
  assert.match(source,/NOT EXISTS \(SELECT 1 FROM enterprise_workers ew WHERE ew\.organization_id=/);
 });
}
