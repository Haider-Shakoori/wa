import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('disabling public purchases preserves existing paid subscription eligibility', async () => {
  const [migration, subscription, onboarding, payment] = await Promise.all([
    read('../migrations/045_public_plan_purchase_availability.sql'),
    read('../src/subscriptions/subscriptions.service.ts'),
    read('../src/onboarding/onboarding.service.ts'),
    read('../src/payments/payments.service.ts'),
  ]);
  assert.match(migration, /available_for_purchase boolean NOT NULL DEFAULT true/);
  const liveSubscription = subscription.slice(subscription.indexOf('  private async getSubscription('));
  assert.match(liveSubscription, /JOIN subscription_plans p ON p.code = s.plan_code AND p.active = true/);
  assert.doesNotMatch(liveSubscription, /available_for_purchase/);
  assert.match(subscription, /WHERE active = true AND available_for_purchase = true/);
  assert.match(onboarding, /WHERE active = true AND available_for_purchase = true/);
  assert.match(onboarding, /WHERE code = \$1 AND active = true AND available_for_purchase = true/);
  assert.match(payment, /WHERE code = \$1 AND active = true AND available_for_purchase = true/);
});

test('public plan availability is explicitly authorized and audited', async () => {
  const [dto, controller, service] = await Promise.all([
    read('../src/platform/platform-admin.dto.ts'),
    read('../src/platform/platform-admin.controller.ts'),
    read('../src/platform/platform-admin.service.ts'),
  ]);
  assert.match(dto, /class WebsitePlanAvailabilityDto/);
  assert.match(dto, /availableForPurchase!: boolean/);
  assert.match(controller, /@Patch\('website-plans\/:code\/availability'\)/);
  assert.match(controller, /updateWebsitePlanAvailability/);
  const method = service.slice(
    service.indexOf('  async updateWebsitePlanAvailability('),
    service.indexOf('  async updateSubscription('),
  );
  assert.match(method, /code === 'trial'/);
  assert.match(method, /this.db.transaction/);
  assert.match(method, /FOR UPDATE/);
  assert.match(method, /UPDATE subscription_plans/);
  assert.match(method, /this.recordAudit/);
  assert.match(method, /available_for_purchase/);
  assert.match(service, /currency, available_for_purchase/);
});
