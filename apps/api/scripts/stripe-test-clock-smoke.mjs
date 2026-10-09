import Stripe from 'stripe';
import assert from 'node:assert/strict';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) throw new Error('Stripe test secret key required: refusing live mode.');
const stripe = new Stripe(key);
const now = Math.floor(Date.now() / 1000);
const clock = await stripe.testHelpers.testClocks.create({
  frozen_time: now,
  name: 'RelayWA isolated billing lifecycle CI',
});
let subscriptionId = null;
async function waitReady() {
  for (let n=0;n<45;n++) {
    const state = await stripe.testHelpers.testClocks.retrieve(clock.id);
    if (state.status === 'ready') return;
    if (state.status === 'internal_failure') throw new Error('Stripe Test Clock internal failure');
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw new Error('Stripe Test Clock timed out');
}
async function advance(seconds) {
  const current = await stripe.testHelpers.testClocks.retrieve(clock.id);
  await stripe.testHelpers.testClocks.advance(clock.id, {frozen_time:current.frozen_time+seconds});
  await waitReady();
}
try {
  const customer=await stripe.customers.create({test_clock:clock.id,description:'RelayWA isolated CI fixture'});
  const product=await stripe.products.create({name:'RelayWA isolated recurring smoke fixture'});
  const price=await stripe.prices.create({product:product.id,currency:'usd',unit_amount:100,recurring:{interval:'month'}});
  const good=await stripe.paymentMethods.attach('pm_card_visa',{customer:customer.id});
  await stripe.customers.update(customer.id,{invoice_settings:{default_payment_method:good.id}});
  const sub=await stripe.subscriptions.create({
    customer:customer.id,items:[{price:price.id}],
    default_payment_method:good.id,
  });
  subscriptionId=sub.id;
  assert.equal(sub.livemode,false);
  await waitReady();
  const before=await stripe.invoices.list({customer:customer.id,limit:15});
  assert.ok(before.data.some(i=>i.billing_reason==='subscription_create'&&i.status==='paid'),'Initial test invoice unpaid');
  console.log('PASS isolated first invoice paid');

  await advance(35*24*60*60);
  const renewal=await stripe.invoices.list({customer:customer.id,limit:20});
  assert.ok(renewal.data.some(i=>i.billing_reason==='subscription_cycle'&&i.status==='paid'),'Recurring invoice not paid');
  console.log('PASS isolated recurring renewal invoice paid');

  // Stripe rejects this declined payment method at attachment time. This
  // confirms decline handling at setup, NOT a failed automatic renewal.
  await assert.rejects(
    stripe.paymentMethods.attach('pm_card_chargeDeclined',{customer:customer.id}),
    (error) => error.code === 'card_declined',
  );
  console.log('PASS isolated rejected-card setup (failed renewal remains unverified)');

  const canceled=await stripe.subscriptions.cancel(sub.id);
  assert.equal(canceled.status,'canceled');
  subscriptionId=null;
  console.log('PASS isolated cancellation');
} finally {
  if(subscriptionId) await stripe.subscriptions.cancel(subscriptionId).catch(()=>{});
  await stripe.testHelpers.testClocks.del(clock.id).catch(()=>{});
}
