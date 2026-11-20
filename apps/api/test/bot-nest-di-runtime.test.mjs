import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(new URL('../src/app.module.ts',import.meta.url));
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,filename);
test('Nest resolves Bot Builder and Stripe webhook controllers in real application module',async()=>{
 const {NestFactory}=require('@nestjs/core');
 const {AppModule}=require('./app.module.ts');
 const {BotsService}=require('./bots/bots.service.ts');
 const {PaymentsController}=require('./payments/payments.controller.ts');
 const {BotsController}=require('./bots/bots.controller.ts');
 const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
 try{
  assert.ok(app.get(BotsService,{strict:false}));
  assert.ok(app.get(PaymentsController,{strict:false}));
  assert.ok(app.get(BotsController,{strict:false}));
 }finally{await app.close();}
});
