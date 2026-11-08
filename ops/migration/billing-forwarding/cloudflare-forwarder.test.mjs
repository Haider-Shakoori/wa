import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { forwardVerifiedStripeEvent } from './cloudflare-forwarder.mjs';
const env={ BILLING_FORWARD_URL:'https://api.example.com/api/billing/stripe/verified-event', BILLING_FORWARD_SECRET:'test-only-secret-with-more-than-32-characters' };
const event={id:'evt_test123',type:'invoice.paid',data:{object:{id:'in_test123'}},livemode:false};
test('signs exactly the forwarded body and timestamp',async()=>{
  const result=await forwardVerifiedStripeEvent(event,env,async(url,request)=>{
    assert.equal(url,env.BILLING_FORWARD_URL);
    const expected='sha256='+createHmac('sha256',env.BILLING_FORWARD_SECRET).update(request.headers['x-relaywa-timestamp']+'.'+request.body).digest('hex');
    assert.equal(request.headers['x-relaywa-signature'],expected);
    assert.deepEqual(JSON.parse(request.body),event);
    return {ok:true};
  });
  assert.equal(result.forwarded,true);
});
test('fails closed on missing configuration',async()=>{
  await assert.rejects(forwardVerifiedStripeEvent(event,{},async()=>({ok:true})),/not configured/);
});
test('rejects unsafe URL',async()=>{
  await assert.rejects(forwardVerifiedStripeEvent(event,{...env,BILLING_FORWARD_URL:'http://example.com/api/billing/stripe/verified-event'},async()=>({ok:true})),/Invalid billing forwarding URL/);
});
test('fails on downstream rejection so Stripe can retry',async()=>{
  await assert.rejects(forwardVerifiedStripeEvent(event,env,async()=>({ok:false,status:503})),/HTTP 503/);
});
import { forwardPendingStripeCheckout } from './cloudflare-forwarder.mjs';
test('signs and forwards pending checkout before completion',async()=>{
  const checkout={paymentId:'test-id',organizationId:'test-org',checkoutId:'cs_test_abc'};
  const settings={...env,BILLING_PENDING_CHECKOUT_URL:'https://api.example.com/api/billing/stripe/pending-checkout'};
  const result=await forwardPendingStripeCheckout(checkout,settings,async(url,req)=>{
    assert.equal(url,settings.BILLING_PENDING_CHECKOUT_URL);
    assert.equal(req.headers['x-relaywa-signature'],'sha256='+createHmac('sha256',settings.BILLING_FORWARD_SECRET).update(req.headers['x-relaywa-timestamp']+'.'+req.body).digest('hex'));
    assert.deepEqual(JSON.parse(req.body),checkout);
    return {ok:true};
  });
  assert.equal(result.synced,true);
});
test('fails closed when pending checkout sync fails',async()=>{
  const settings={...env,BILLING_PENDING_CHECKOUT_URL:'https://api.example.com/api/billing/stripe/pending-checkout'};
  await assert.rejects(forwardPendingStripeCheckout({paymentId:'x',organizationId:'y',checkoutId:'cs_test_abc'},settings,async()=>({ok:false,status:503})),/HTTP 503/);
});

[executed on device: businessos-dev-vps (9b1cdbf1-1a02-4fe8-9e81-8871c3eca22c)]