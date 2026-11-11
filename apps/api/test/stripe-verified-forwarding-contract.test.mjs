import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/payments/payments.controller.ts',import.meta.url),'utf8');
test('forwarded events require a dedicated secret and signed raw body',()=>{
  assert.match(source,/RELAYWA_BILLING_FORWARD_SECRET/);
  assert.match(source,/createHmac\('sha256', secret\)/);
  assert.match(source,/update\(timestamp\)\.update\('\.'\)\.update\(request\.rawBody\)/);
  assert.match(source,/timingSafeEqual\(expected, supplied\)/);
});
test('reject expired timestamps, malformed signatures and missing envelope',()=>{
  assert.match(source,/Math\.abs\(Date\.now\(\) \/ 1000 - Number\(timestamp\)\) > 300/);
  assert.match(source,/sha256=\[a-f0-9\]\{64\}/);
  assert.match(source,/event\.data\?\.object/);
});
test('forwarded events use existing billing service and do not create checkout',()=>{
  const handler=source.split("@Post('stripe/verified-event')")[1].split("@Post('stripe/webhook')")[0];
  assert.match(handler,/this\.payments\.handleForwardedStripeEvent\(event\)/);
  assert.doesNotMatch(handler,/createStripeCheckout|constructEvent/);
});
