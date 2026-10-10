import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {verifyRelayWaWebhook, createRelayWaClient, createWebhookListener}
  from '../../../examples/relaywa-node-webhooks/server.mjs';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

function evaluate(path){
  const out=ts.transpileModule(read(path),{fileName:path,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  runInNewContext(out,{exports},{filename:path});
  return exports;
}
const {publishedArticles,getPublishedArticle}=evaluate('lib/blog-articles.ts');

test('published English collection has only two genuinely distinct developer tutorials',()=>{
  assert.equal(publishedArticles.length,2);
  assert.deepEqual(Array.from(publishedArticles,x=>x.slug),
    ['nodejs-whatsapp-api-send-webhooks','laravel-whatsapp-api-order-notifications']);
  for(const x of publishedArticles){
    assert.ok(x.blocks.length>=4);
    assert.ok(x.title.length>=45);
    assert.ok(x.description.length>=90);
    assert.match(x.publishedAt,/^\d{4}-\d{2}-\d{2}$/);
    assert.match(x.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(x.sourcePath.startsWith('examples/relaywa-'));
    assert.ok(readFileSync(new URL('../../..//'+x.sourcePath,root),'utf8').length>250);
    const headings=new Set(x.blocks.map(b=>b.id));
    assert.equal(headings.size,x.blocks.length,'Unique section anchors');
    assert.ok(x.blocks.every(b=>b.paragraphs.every(p=>p.length>60)));
  }
  assert.equal(getPublishedArticle('not-published'),undefined);
  assert.ok(getPublishedArticle('nodejs-whatsapp-api-send-webhooks'));
  assert.ok(getPublishedArticle('laravel-whatsapp-api-order-notifications'));
});

test('Node sending uses HTTPS, server credentials, stable clientMessageId and parsed API data',async()=>{
  const calls=[];
  const sender=createRelayWaClient({sessionKey:'test-only-private',fetchImpl:async(url,init)=>{
    calls.push({url,init});
    return {ok:true,status:200,json:async()=>({success:true,data:{id:'message-one',status:'sent'}})};
  }});
  const result=await sender({to:'12025550123',text:'Your order is ready',clientMessageId:'order-123-ready-v1'});
  assert.equal(result.id,'message-one');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://relaywa.com/api/send-message');
  assert.equal(calls[0].init.headers.Authorization,'Bearer test-only-private');
  assert.deepEqual(JSON.parse(calls[0].init.body),{
    to:'12025550123',text:'Your order is ready',clientMessageId:'order-123-ready-v1'});
  assert.throws(()=>createRelayWaClient({sessionKey:'secret',apiBase:'http://localhost:3000/api'}),/HTTPS/);
  await assert.rejects(()=>sender({to:'+1 202',text:'hi',clientMessageId:'order123'}),/international recipient/);
});

test('uncertain outbound send and auth rejection never trigger blind retries',async()=>{
  let times=0;
  const unavailable=createRelayWaClient({sessionKey:'key',fetchImpl:async()=>{
    times++;
    throw new Error('socket closed');
  }});
  await assert.rejects(()=>unavailable({to:'12025550123',text:'hi',clientMessageId:'order1'}),
    /outcome uncertain/);
  assert.equal(times,1);
  const blocked=createRelayWaClient({sessionKey:'key',fetchImpl:async()=>({
    ok:false,status:409,json:async()=>({messageId:'message-unknown'})
  })});
  await assert.rejects(async()=>{
    await blocked({to:'12025550123',text:'hi',clientMessageId:'order1'});
  },e=>e.status===409 && e.messageId==='message-unknown');
});

test('webhook signature uses timestamp + period + RAW body bytes and constant-time digest comparison',()=>{
  const secret='webhook-test-only',nowSeconds=1791378000;
  const raw=Buffer.from('{\n  "id":"event-1", "type":"message.received" }\n','utf8');
  const hex=createHmac('sha256',secret).update('1791378000').update('.').update(raw).digest('hex');
  const headers={'x-relaywa-timestamp':String(nowSeconds),'x-relaywa-signature':'sha256='+hex};
  assert.equal(verifyRelayWaWebhook(raw,headers,secret,{nowSeconds}),true);
  assert.equal(verifyRelayWaWebhook(Buffer.from(JSON.stringify(JSON.parse(raw))),headers,secret,{nowSeconds}),false);
  assert.equal(verifyRelayWaWebhook(raw,headers,'wrong',{nowSeconds}),false);
  assert.equal(verifyRelayWaWebhook(raw,headers,secret,{nowSeconds:nowSeconds+301}),false);
  assert.equal(verifyRelayWaWebhook(raw,{...headers,'x-relaywa-signature':'sha256=bad'},secret,{nowSeconds}),false);
  assert.equal(verifyRelayWaWebhook(raw,{...headers,'x-relaywa-timestamp':'garbage'},secret,{nowSeconds}),false);
});

test('webhook listener accepts signed JSON, rejects invalid HMAC, and calls handler only on valid events',async()=>{
  const secret='secret-test',nowSeconds=1791378000,seen=[];
  const raw=Buffer.from('{"id":"evt1","type":"message.received","data":{}}');
  const signature=createHmac('sha256',secret).update(String(nowSeconds)).update('.').update(raw).digest('hex');
  const handle=createWebhookListener({secret,onEvent:async(x)=>seen.push(x),nowSeconds:()=>nowSeconds});
  const deliver=async signatureValue=>{
    const req=Readable.from([raw]);
    req.method='POST';req.url='/incoming-relaywa-webhook';
    req.headers={'x-relaywa-timestamp':String(nowSeconds),'x-relaywa-signature':signatureValue};
    const result={status:0,body:''};
    await handle(req,{writeHead(s){result.status=s;},end(x=''){result.body=String(x);}});
    return result.status;
  };
  assert.equal(await deliver('sha256='+signature),204);
  assert.equal(await deliver('sha256='+'f'.repeat(64)),401);
  assert.equal(seen.length,1);
  assert.equal(seen[0].id,'evt1');
});

test('reviewed public routes, metadata, sitemap and analytics allowlist match real tutorial inventory',()=>{
  const paths=read('lib/public-pages.ts');
  const sitemap=read('app/sitemap.ts');
  const docs=read('app/blog/[slug]/page.tsx');
  const index=read('app/blog/page.tsx');
  const home=read('components/relay-home.tsx');
  assert.match(paths,/export const editorialPages/);
  assert.match(paths,/export const allPublishedPages/);
  for(const article of publishedArticles){
    assert.ok(paths.includes("/blog/"+article.slug));
    assert.ok(index.includes('publishedArticles.map'));
  }
  assert.match(sitemap,/editorialPages/);
  assert.match(docs,/generateStaticParams/);
  assert.match(docs,/notFound\(\)/);
  assert.match(docs,/BreadcrumbList/);
  assert.match(docs,/TechArticle/);
  assert.match(docs,/datePublished/);
  assert.match(docs,/getPublishedArticle\(slug\)/);
  assert.match(docs,/canonicalUrl\('\/blog\/'\+a.slug\)/);
  assert.match(home,/href="\/blog"/);
  assert.doesNotMatch(paths,/\/countries\/(india|brazil)/);
});

test('Laravel sample remains a template, uses server-side config, validates HMAC before parsing JSON',()=>{
  const php=readFileSync(new URL('../../../examples/relaywa-laravel/app/Services/RelayWaOrderNotifier.php',import.meta.url),'utf8');
  const webhook=readFileSync(new URL('../../../examples/relaywa-laravel/app/Http/Controllers/RelayWaWebhookController.php',import.meta.url),'utf8');
  assert.match(php,/Http::withToken\(\$key\)/);
  assert.match(php,/clientMessageId/);
  assert.match(php,/order-\{\$orderId\}-ready-v1/);
  assert.match(php,/https:\/\/relaywa\.com\/api/);
  assert.doesNotMatch(php,/Http::retry\(/);
  assert.match(webhook,/\$request->getContent\(\)/);
  assert.match(webhook,/hash_hmac\('sha256'/);
  assert.match(webhook,/hash_equals/);
  assert.match(webhook,/Cache::add/);
  assert.ok(webhook.indexOf('hash_equals(')<webhook.indexOf('json_decode('));
});
