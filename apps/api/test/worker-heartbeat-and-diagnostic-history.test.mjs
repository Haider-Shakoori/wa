import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(p)=>readFile(new URL(p,import.meta.url),'utf8');

test('worker process heartbeat is independent from each WhatsApp session lease',async()=>{
 const [migration,store,loop,platform]=await Promise.all([
  read('../migrations/040_worker_diagnostic_lifecycle.sql'),
  read('../../worker/src/session-store.js'),
  read('../../worker/src/command-loop.js'),
  read('../src/platform/platform-admin.service.ts'),
 ]);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS relaywa_worker_heartbeats/);
 assert.match(store,/async heartbeatWorker\(\)/);
 assert.match(store,/ON CONFLICT\(worker_id\) DO UPDATE SET last_seen_at=now\(\)/);
 assert.match(loop,/await store\.heartbeatWorker\(\)/);
 assert.match(loop,/15_000/);
 const block=platform.slice(platform.indexOf('  async workers()'),platform.indexOf('  async queues()'));
 assert.match(block,/relaywa_worker_heartbeats/);
 assert.match(block,/FULL OUTER JOIN sessions_by_worker/);
 assert.match(block,/last_seen_at>now\(\)-interval '90 seconds'/);
 assert.match(block,/health_state/);
 assert.match(block,/stale_session_leases/);
 assert.doesNotMatch(block,/CASE WHEN s\.lease_expires_at.*online/);
});

test('incident archives preserve failure rows and auto restore new problems to active view',async()=>{
 const [migration,service,controller]=await Promise.all([
  read('../migrations/040_worker_diagnostic_lifecycle.sql'),
  read('../src/platform/platform-admin.service.ts'),
  read('../src/platform/platform-admin.controller.ts'),
 ]);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS platform_diagnostic_archives/);
 assert.match(migration,/ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS resolved_at/);
 const block=service.slice(service.indexOf('  async recentErrors('),service.indexOf('  async supportAnswer('));
 assert.match(block,/view:'active'\|'archived'/);
 assert.match(block,/a\.archived_at>=t\.updated_at/);
 assert.match(block,/archived_by/);
 assert.match(block,/diagnostic\.archived/);
 assert.doesNotMatch(block,/DELETE FROM whatsapp_messages|DELETE FROM webhook_deliveries|DELETE FROM whatsapp_sessions/);
 assert.match(controller,/@Patch\('diagnostics\/:resource\/:id\/archive'\)/);
 assert.match(controller,/@PlatformRoles\('super_admin','support_admin'\)/);
 assert.match(controller,/ArchiveDiagnosticDto/);
});

test('acknowledged and resolved alerts are distinct; resolved incidents keep an audit trail',async()=>{
 const service=await read('../src/platform/platform-admin.service.ts');
 assert.match(service,/async setAlertAcknowledgement\(/);
 assert.match(service,/async setAlertResolution\(/);
 assert.match(service,/monitoring\.alert\.resolved/);
 assert.match(service,/resolved_at=CASE WHEN \$2 THEN now\(\) ELSE NULL END/);
 assert.match(service,/lifecycle = 'active'/);
 const worker=await read('../../worker/src/session-store.js');
 assert.match(worker,/a\.event_type='worker\.session_lease_expired'/);
 assert.match(worker,/s\.worker_lease_expires_at>now\(\)/);
});
