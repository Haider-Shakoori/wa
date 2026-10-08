import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');

test('super and billing admins can create and edit the public plan catalog with audit',async()=>{
 const [controller,service,dto,publicRoute]=await Promise.all([
   read('../src/platform/platform-admin.controller.ts'),
   read('../src/platform/platform-admin.service.ts'),
   read('../src/platform/platform-admin.dto.ts'),
   read('../src/app.controller.ts'),
 ]);
 assert.match(controller,/@Post\('website-plans'\)\s+@PlatformRoles\('super_admin','billing_admin'\)/);
 assert.match(controller,/@Patch\('website-plans\/:code'\)\s+@PlatformRoles\('super_admin','billing_admin'\)/);
 assert.match(controller,/@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
 assert.match(dto,/class WebsitePlanDto/);
 assert.match(dto,/@MinLength\(8\)/);
 const section=service.slice(service.indexOf('  async createWebsitePlan('),service.indexOf('  async updateSubscription('));
 assert.match(section,/INSERT INTO subscription_plans/);
 assert.match(section,/UPDATE subscription_plans/);
 assert.match(section,/this.db.transaction\(async client/);
 assert.match(section,/website.plan.created/);
 assert.match(section,/website.plan.updated/);
 assert.match(section,/Plan code cannot be changed/);
 assert.match(section,/code === 'trial'/);
 assert.doesNotMatch(section,/DELETE FROM subscription_plans|UPDATE payments|UPDATE organization_subscriptions/);
 assert.match(publicRoute,/@Get\(\['public\/plans','v1\/public\/plans'\]\)/);
 assert.match(publicRoute,/return this.subscriptions.listPlans\(\)/);
});

test('switching a paid client plan calculates expiry from the billing interval and audits the change',async()=>{
 const [service,dto,editor]=await Promise.all([
   read('../src/platform/platform-admin.service.ts'),
   read('../src/platform/platform-admin.dto.ts'),
   read('../../web/components/platform-client-subscription-editor.tsx'),
 ]);
 const block=service.slice(service.indexOf('  async updateSubscription('),service.indexOf('  async authProviders('));
 assert.match(dto,/billingInterval\?: 'monthly' \| 'annual'/);
 assert.match(block,/const planChanged=planCode!==before\?\.plan_code/);
 assert.match(block,/input\.billingInterval \|\| \(planChanged && status==='active'\)/);
 assert.match(block,/now\(\) \+ \(\$1 \* interval '1 month'\)/);
 assert.match(block,/selected_billing_interval/);
 assert.match(editor,/setTermAction\(selected==='trial'\?'extend':'billing'\)/);
 assert.match(editor,/New expiration:/);
 assert.match(editor,/billingInterval/);
 assert.match(editor,/termAction==='billing'\?\{billingInterval\}/);
});
