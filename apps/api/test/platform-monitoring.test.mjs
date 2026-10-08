import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('monitoring alerts are guarded, filtered and role-scoped',async()=>{
 const controller=await source('../src/platform/platform-admin.controller.ts');
 const service=await source('../src/platform/platform-admin.service.ts');
 const migration=await source('../migrations/032_platform_alert_management.sql');
 assert.match(controller, /monitoring\/overview/);
 assert.match(controller, /monitoring\/alerts/);
 assert.match(controller, /@PlatformRoles\('super_admin','support_admin'\)/);
 assert.match(service, /async monitoringOverview\(/);
 assert.match(service, /async monitoringAlerts\(/);
 assert.match(service, /LIMIT 150/);
 assert.match(service, /async setAlertAcknowledgement\(/);
 assert.match(service, /FOR UPDATE/);
 assert.match(service, /monitoring\.alert\.acknowledged/);
 assert.match(service, /monitoring\.alert\.reopened/);
 assert.match(migration, /acknowledged_by/);
 assert.match(migration, /acknowledged_at/);
 assert.doesNotMatch(service.slice(service.indexOf('  async setAlertAcknowledgement'),service.indexOf('  async auditLogs(')), /SET status=/);
});
test('monitoring displays worker leases and alert review independently of delivery status',async()=>{
 const screen=await source('../../web/components/platform-monitoring.tsx');
 const page=await source('../../web/app/platform/page.tsx');
 assert.match(page,/items:\['Monitoring'/);
 assert.match(screen,/leaseActive/);
 assert.match(screen,/Unacknowledged alerts/);
 assert.match(screen,/setInterval/);
 assert.match(screen,/Acknowledge/);
 assert.match(screen,/Reopen/);
 assert.match(screen,/Acknowledge an alert does not cancel|Acknowledging an alert does not cancel/);
});

test('webhook 24h monitoring uses the persisted webhook delivery timestamp',async()=>{
  const service=await source('../src/platform/platform-admin.service.ts');
  const start=service.indexOf('  async monitoringOverview()');
  const end=service.indexOf('  async monitoringAlerts(',start);
  assert.ok(start>=0&&end>start);
  const overview=service.slice(start,end);
  assert.match(overview,/FROM webhook_deliveries WHERE queued_at >= now\(\)-interval '24 hours'/);
  assert.doesNotMatch(overview,/FROM webhook_deliveries WHERE created_at/);
});
