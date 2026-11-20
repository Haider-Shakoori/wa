import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(new URL('../src/bots/bots.service.ts',import.meta.url));
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>{
 const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText;
 mod._compile(js,filename);
};
const {BotsService}=require('./bots.service.ts');
const org='00000000-0000-4000-8000-000000000001';
const order='00000000-0000-4000-8000-000000000002';
const session='cs_test_isolated_123';
const subscription='sub_test_isolated_123';
function event(overrides={}){
 return {type:'checkout.session.completed',livemode:false,data:{object:{
  id:session,mode:'subscription',payment_status:'paid',subscription,
  currency:'usd',amount_total:500,metadata:{relaywa_product:'bot_addon',
   relaywa_bot_order_id:order,organization_id:org,bot_plan:'starter'},...overrides}}};
}
function harness({status='pending',checkoutId=session}={}){
 const statements=[];let committed=false;let rolledBack=false;let entitlement=false;
 const client={async query(sql,values=[]){
  statements.push({sql,values});
  if(sql.startsWith('SELECT organization_id FROM relaywa_bot_checkout_orders'))
   return {rows:[{organization_id:org}],rowCount:1};
  if(sql.startsWith('SELECT id FROM organizations'))return {rows:[{id:org}],rowCount:1};
  if(sql.startsWith('SELECT * FROM relaywa_bot_checkout_orders'))
   return {rows:[{status,organization_id:org,plan_code:'starter',amount_cents:500,
    stripe_livemode:false,stripe_checkout_id:checkoutId}],rowCount:1};
  if(sql.startsWith('SELECT stripe_subscription_id FROM relaywa_bot_entitlements'))
   return {rows:[],rowCount:0};
  if(sql.includes('INSERT INTO relaywa_bot_entitlements'))entitlement=true;
  return {rows:[],rowCount:1};
 }};
 const db={async transaction(fn){
  try{const result=await fn(client);committed=true;return result;}
  catch(error){rolledBack=true;throw error;}
 },query:client.query};
 return {service:new BotsService(db,{}),statements,
  get committed(){return committed;},get rolledBack(){return rolledBack;},
  get entitlement(){return entitlement;}};
}
test('verified checkout activates Bot Builder in transactional flow',async()=>{
 const h=harness();assert.deepEqual(await h.service.handleStripeEvent(event()),{activated:true});
 assert.equal(h.committed,true);assert.equal(h.entitlement,true);
 assert.ok(h.statements.some(x=>x.sql.includes("SET status='paid'")));
});
test('tampered amount rejects checkout and rolls back entitlement',async()=>{
 const h=harness();await assert.rejects(h.service.handleStripeEvent(event({amount_total:1200})),/verification failed/);
 assert.equal(h.rolledBack,true);assert.equal(h.entitlement,false);
});
test('wrong Stripe mode cannot find matching checkout order',async()=>{
 const h=harness();await assert.rejects(h.service.handleStripeEvent({...event(),livemode:true}),/verification failed/);
 assert.equal(h.entitlement,false);
 assert.deepEqual(h.statements[0].values,[order,true]);
});
test('replayed paid checkout is idempotent',async()=>{
 const h=harness({status:'paid'});assert.deepEqual(await h.service.handleStripeEvent(event()),{duplicate:true});
 assert.equal(h.entitlement,false);
});
test('expired checkout cannot activate',async()=>{
 const h=harness({status:'expired'});assert.deepEqual(await h.service.handleStripeEvent(event()),{ignored:true});
 assert.equal(h.entitlement,false);
});
