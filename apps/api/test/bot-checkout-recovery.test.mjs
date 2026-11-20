import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const service=readFileSync(new URL('../src/bots/bots.service.ts',import.meta.url),'utf8');
test('abandoned Stripe checkout is expired before a retry',()=>{
 assert.match(service,/UPDATE relaywa_bot_checkout_orders SET status='expired'/);
 assert.match(service,/created_at < now\(\) - interval '25 hours'/);
});
test('checkout recovery only expires same organization and Stripe mode',()=>{
 assert.match(service,/WHERE organization_id=\$1 AND stripe_livemode=\$2 AND status='pending'/);
 assert.match(service,/\[org,livemode\]/);
});
test('new checkout still requires a signed paid webhook to activate',()=>{
 assert.match(service,/if \(order.status!=='pending'\) return \{ignored:true\}/);
 assert.match(service,/verifyBotAddonCheckout/);
 assert.match(service,/if \(!checked.verified\) throw new BadRequestException/);
});
