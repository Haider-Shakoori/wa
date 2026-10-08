import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('platform client subscription mutations are authorized and audited transactionally', async()=>{
  const [service,controller,dto]=await Promise.all([
    read('../src/platform/platform-admin.service.ts'),
    read('../src/platform/platform-admin.controller.ts'),
    read('../src/platform/platform-admin.dto.ts'),
  ]);
  const start=service.indexOf('  async updateSubscription(');
  const end=service.indexOf('  async authProviders(',start);
  const update=service.slice(start,end);
  assert.ok(update.length>1500);
  assert.match(controller, /@Get\('subscription-plans'\)/);
  assert.match(controller, /@PlatformRoles\('super_admin','billing_admin'\)/);
  assert.match(controller, /@Param\('organizationId', ParseUUIDPipe\) organizationId: string/);
  assert.match(update, /this\.db\.transaction\(async \(client\) =>/);
  assert.match(update, /FROM organizations WHERE id=\$1 FOR UPDATE/);
  assert.match(update, /FROM organization_subscriptions\s+WHERE organization_id=\$1 FOR UPDATE/);
  assert.match(update, /ON CONFLICT \(organization_id\) DO UPDATE SET/);
  assert.match(update, /await this\.recordAudit\(client,actorUserId,'subscription\.updated'/);
  assert.match(update, /reason/);
  assert.match(dto, /periodEndDate\?: string/);
  assert.match(dto, /@IsOptional\(\) @Matches\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\)/);
});

test('activation fixes an already expired billing period instead of simply setting active status',async()=>{
  const platform=await read('../src/platform/platform-admin.service.ts');
  const start=platform.indexOf('  async updateSubscription(');
  const end=platform.indexOf('  async authProviders(',start);
  const update=platform.slice(start,end);
  assert.match(update, /previousEnd\.getTime\(\)>now\.getTime\(\)/);
  assert.match(update, /new Date\(now\.getTime\(\)\+\(\(status==='trialing'\)\?7:30\)\*86400000\)/);
  assert.match(update, /explicitEnd\.toISOString\(\)\.slice\(0,10\) !== input\.periodEndDate/);
  assert.match(update, /trialEnd=status==='trialing'\?end:null/);
  assert.match(update, /planCode=input\.planCode\?\?before\?\.plan_code/);
  assert.match(update, /client/i);
});

test('tenant billing details remain visible after expiration but message access is gated',async()=>{
  const subscription=await read('../src/subscriptions/subscriptions.service.ts');
  assert.match(subscription,/const subscription = await this\.getSubscription\(organizationId\);\s+const usage/);
  assert.match(subscription,/effectiveStatus:/);
  assert.match(subscription,/canSendMessages:/);
  assert.match(subscription,/async assertCanSendMessage\(/);
  assert.match(subscription,/async assertCanCreateSession\(/);
  assert.match(subscription,/new Date\(subscription\.trial_ends_at\)\.getTime\(\) <= Date\.now\(\)/);
});

test('worker stops claiming queued outbound messages for paused or expired subscriptions',async()=>{
  const worker=await read('../../worker/src/session-store.js');
  const start=worker.indexOf('async claimDirectMessage(');
  const end=worker.indexOf('async saveInboundMessage(',start);
  const claim=worker.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(claim,/organization_subscriptions sub/);
  assert.match(claim,/sub\.organization_id=m\.organization_id/);
  assert.match(claim,/sub\.status IN \('trialing','active'\)/);
  assert.match(claim,/sub\.current_period_end>now\(\)/);
  assert.match(claim,/sub\.trial_ends_at>now\(\)/);
  assert.doesNotMatch(claim,/DELETE FROM whatsapp_messages/);
});

test('admin lists show effective subscription status rather than expired active labels',async()=>{
  const service=await read('../src/platform/platform-admin.service.ts');
  assert.match(service,/effective_subscription_status/);
  assert.match(service,/effective_status/);
  assert.match(service,/s\.trial_ends_at<=now\(\)/);
});
