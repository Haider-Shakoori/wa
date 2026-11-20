import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const url=new URL('../src/bots/bots.service.ts',import.meta.url);
const require=createRequire(url);
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,filename);
const {BotsService}=require('./bots.service.ts');
const {DatabaseService}=require('../database/database.service.ts');
const {randomUUID}=require('node:crypto');
const org='00000000-0000-4000-8000-000000000001';
const testUrl=process.env.BOT_E2E_DATABASE_URL;
const databaseUrl=process.env.DATABASE_URL;
if(testUrl){
 const target=new URL(testUrl);
 if(databaseUrl!==testUrl || target.hostname!=='127.0.0.1' ||
    target.port!=='55439' || target.pathname!=='/bot_e2e')
   throw new Error('Bot E2E requires the explicitly isolated local bot_e2e database');
}
const db=testUrl?new DatabaseService():null;
test('isolated PostgreSQL checkout, activation, replay, renewal and cancellation', {skip:!db}, async()=>{
 try{
  const checkoutId='cs_test_'+randomUUID(),sub='sub_test_'+randomUUID();
  const stripe={isLiveMode:()=>false,createBotAddonCheckout:async()=>({checkoutId,url:'https://checkout.stripe.com/test'}),
   getBotSubscriptionPeriod:async()=>({start:Math.floor(Date.now()/1000),end:Math.floor(Date.now()/1000)+30*86400})};
  const bots=new BotsService(db,stripe);
  await db.query('DELETE FROM relaywa_bot_renewal_events WHERE organization_id=$1',[org]);
  await db.query('DELETE FROM relaywa_bot_entitlements WHERE organization_id=$1',[org]);
  await db.query('DELETE FROM relaywa_bot_checkout_orders WHERE organization_id=$1',[org]);
  const checkout=await bots.checkout(org,'starter');
  assert.equal(checkout.checkoutUrl,'https://checkout.stripe.com/test');
  const created=await db.query('SELECT * FROM relaywa_bot_checkout_orders WHERE id=$1',[checkout.orderId]);
  assert.equal(created.rows[0].status,'pending');
  const webhook={type:'checkout.session.completed',livemode:false,data:{object:{
   id:checkoutId,mode:'subscription',payment_status:'paid',subscription:sub,
   currency:'usd',amount_total:500,metadata:{relaywa_product:'bot_addon',
    relaywa_bot_order_id:checkout.orderId,organization_id:org,bot_plan:'starter'}}}};
  // The fake Stripe Checkout ID must match the order to simulate a verified session.
  await db.query('UPDATE relaywa_bot_checkout_orders SET stripe_checkout_id=$2 WHERE id=$1',
   [checkout.orderId,checkoutId]);
  assert.deepEqual(await bots.handleStripeEvent(webhook),{activated:true});
  assert.deepEqual(await bots.handleStripeEvent(webhook),{duplicate:true});
  assert.equal((await bots.entitlement(org)).entitled,true);
  const activated=await db.query('SELECT current_period_start,current_period_end FROM relaywa_bot_entitlements WHERE organization_id=$1',[org]);
  assert.ok(new Date(activated.rows[0].current_period_end)>new Date(activated.rows[0].current_period_start));
  const invoice={type:'invoice.paid',livemode:false,data:{object:{
   id:'in_test_'+randomUUID(),status:'paid',billing_reason:'subscription_cycle',
   amount_paid:500,currency:'usd',parent:{subscription_details:{subscription:sub}},
   lines:{data:[{parent:{subscription_item_details:{subscription:sub}},
    period:{start:Math.floor(Date.now()/1000)+35*86400,end:Math.floor(Date.now()/1000)+65*86400}}]}}}};
  assert.deepEqual(await bots.handleStripeEvent(invoice),{renewed:true});
  assert.deepEqual(await bots.handleStripeEvent(invoice),{duplicate:true});
  assert.deepEqual(await bots.handleStripeEvent({type:'customer.subscription.deleted',livemode:false,
   data:{object:{id:sub}}}),{restricted:true});
  assert.equal((await bots.entitlement(org)).entitled,false);
  assert.deepEqual(await bots.handleStripeEvent({...invoice,data:{object:{...invoice.data.object,
   id:'in_test_'+randomUUID()}}}),{ignored:true,reason:'subscription_canceled'});
 }finally{
  await db.query('DELETE FROM relaywa_bot_renewal_events WHERE organization_id=$1',[org]);
  await db.query('DELETE FROM relaywa_bot_entitlements WHERE organization_id=$1',[org]);
  await db.query('DELETE FROM relaywa_bot_checkout_orders WHERE organization_id=$1',[org]);
  await db.onModuleDestroy();
 }
});
