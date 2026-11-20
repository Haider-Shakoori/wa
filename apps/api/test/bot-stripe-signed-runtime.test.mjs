import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import Module from 'node:module';
const sourceUrl=new URL('../src/payments/stripe.provider.ts',import.meta.url);
const filename=fileURLToPath(sourceUrl);
const require=createRequire(sourceUrl);
const ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(sourceUrl,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},
}).outputText;
const loaded=new Module(filename);
loaded.filename=filename;
loaded.paths=Module._nodeModulePaths(filename.slice(0,filename.lastIndexOf('/')));
loaded._compile(compiled,filename);
const {StripeProvider}=loaded.exports;
const Stripe=require('stripe');
function withStripeEnv(work){
 const keys=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_MODE'];
 const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.STRIPE_SECRET_KEY='sk_test_isolated_dummy_key';
 process.env.STRIPE_WEBHOOK_SECRET='whsec_isolated_runtime_test';
 process.env.STRIPE_MODE='test';
 try{return work();}finally{
  for(const key of keys) original[key]===undefined?delete process.env[key]:process.env[key]=original[key];
 }
}
function signedEvent(overrides={}){
 const payload=JSON.stringify({id:'evt_bot_isolated',type:'checkout.session.completed',livemode:false,
 data:{object:{id:'cs_test_bot',metadata:{relaywa_product:'bot_addon'}}},...overrides});
 const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
 return {body:Buffer.from(payload),signature};
}
test('existing Stripe provider accepts valid test-mode signed bot webhook without network',()=>withStripeEnv(()=>{
 const provider=new StripeProvider();
 const {body,signature}=signedEvent();
 const event=provider.constructEvent(body,signature);
 assert.equal(event.type,'checkout.session.completed');
 assert.equal(event.data.object.metadata.relaywa_product,'bot_addon');
}));
test('existing Stripe provider rejects tampered bot webhook',()=>withStripeEnv(()=>{
 const provider=new StripeProvider();
 const {signature}=signedEvent();
 assert.throws(()=>provider.constructEvent(Buffer.from('{"tampered":true}'),signature),/Invalid Stripe webhook signature/);
}));
test('existing Stripe provider rejects live-mode event with test-mode credentials',()=>withStripeEnv(()=>{
 const provider=new StripeProvider();
 const {body,signature}=signedEvent({livemode:true});
 assert.throws(()=>provider.constructEvent(body,signature),/event mode does not match server mode/);
}));
