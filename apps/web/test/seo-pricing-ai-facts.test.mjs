import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pricing = readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');

test('pricing page exposes factual product metadata without a public vendor comparison', () => {
  assert.match(pricing, /'@type': 'SoftwareApplication'/);
  assert.match(pricing, /'applicationCategory': 'DeveloperApplication'|applicationCategory: 'DeveloperApplication'/);
  assert.match(pricing, /'Direct outbound sending; application-managed scheduling, pacing and outbound retries'/);
  assert.match(pricing, /'Signed webhook events'/);
  assert.match(pricing, /'Subscription pricing per connected session without a separate RelayWA per-message fee'/);
  assert.match(pricing, /JSON.stringify\(productFacts\)/);
  assert.doesNotMatch(pricing, /wasenderapi|AggregateRating|priceCurrency|priceSpecification/i);
});
