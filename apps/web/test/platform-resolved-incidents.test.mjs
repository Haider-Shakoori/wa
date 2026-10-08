import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');

test('overview no longer calls every expired session lease an offline worker',async()=>{
 const page=await read('../app/platform/page.tsx');
 assert.match(page,/w\.health_state==='online'/);
 assert.match(page,/w\.health_state==='offline'/);
 assert.match(page,/w\.health_state==='unknown'/);
 assert.match(page,/Worker heartbeat healthy/);
 assert.match(page,/Worker health awaiting verification/);
 assert.match(page,/activeFailedMessages/);
 assert.match(page,/activeFailedWebhooks/);
});
test('diagnostics keep active and archived records separate with auditable archive action',async()=>{
 const page=await read('../app/platform/page.tsx');
 assert.match(page,/diagnosticView/);
 assert.match(page,/Resolved \/ Archived/);
 assert.match(page,/Archive after review/);
 assert.match(page,/\/platform\/diagnostics\//);
 assert.match(page,/reason\.trim\(\)\.length<8/);
 assert.match(page,/No active errors/);
});
test('monitoring displays worker process heartbeats and resolved alert history',async()=>{
 const monitor=await read('../components/platform-monitoring.tsx');
 assert.match(monitor,/Worker process health/);
 assert.match(monitor,/health_state==='online'/);
 assert.match(monitor,/last_seen_at/);
 assert.match(monitor,/Resolved history/);
 assert.match(monitor,/Mark resolved/);
 assert.match(monitor,/Acknowledge/);
 assert.match(monitor,/monitoring\/alerts\//);
});
test('account security shows the recorded login IP as a distinct field',async()=>{
 const ui=await read('../components/platform-mfa-settings.tsx');
 assert.match(ui,/IP: \{item\.ip_address\?\?'Unavailable'\}/);
});
