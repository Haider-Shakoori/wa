import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseCsv } from '../../../scripts/seo-keyword-research-audit.mjs';

const root = new URL('../../../',import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');

function getPages(){
  const source=read('apps/web/lib/public-pages.ts');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  runInNewContext(code,{exports});
  return exports;
}

test('three core published SEO pages have distinct high-intent metadata with accurate product positioning',()=>{
  const {publicPages,allPublishedPages}=getPages();
  assert.equal(publicPages.length,4,'Retain exactly four foundational public pages');
  assert.equal(allPublishedPages.length,8,'Do not accidentally publish thin or draft routes');
  const paths=['/','/pricing','/api-docs'];
  const wanted=[
    ['WhatsApp API for Developers','QR code','signed webhooks'],
    ['WhatsApp API Pricing & Cost','monthly and annual','7-day trial'],
    ['WhatsApp REST API Documentation & Integration','Node.js','Laravel'],
  ];
  const titles=new Set();
  paths.forEach((path,i)=>{
    const page=publicPages.find(p=>p.path===path);
    assert.ok(page,'Published page missing: '+path);
    assert.ok(page.title.length>=30&&page.title.length<=70,'Title length: '+path);
    assert.ok(page.description.length>=110&&page.description.length<=165,'Description length: '+path);
    assert.ok(page.title.includes(wanted[i][0]),'Missing intent title: '+path);
    for(const term of wanted[i].slice(1))assert.ok(page.description.includes(term),path+' missing '+term);
    assert.equal(titles.has(page.title),false,'Duplicate title');
    titles.add(page.title);
    assert.doesNotMatch(page.title+' '+page.description,/official whatsapp cloud api access|ban.proof|guaranteed delivery/i);
  });
  assert.ok(!allPublishedPages.some(p=>/\/countries\/|\/integrations\//.test(p.path)));
  assert.equal(new Set(allPublishedPages.map(p=>p.path)).size,8);
});

test('keyword mapping is actionable and prevents duplicate primary canonical targets',()=>{
  const [header,...raw]=parseCsv(read('docs/seo/core-pages-keyword-implementation.csv'));
  assert.deepEqual(header,['keyword','search_intent','canonical_target','role','implementation_status','evidence_area']);
  assert.equal(raw.length,15);
  const {allPublishedPages}=getPages();
  const published=new Set(allPublishedPages.map(p=>p.path));
  const keys=new Set(),primary=new Map();
  for(const [keyword,intent,path,role,status,evidence] of raw){
    assert.ok(keyword.length>8);
    assert.ok(intent.length>3&&evidence.length>10);
    assert.ok(published.has(path),'Keyword maps to unpublished URL: '+path);
    assert.ok(['primary','secondary','supporting'].includes(role));
    assert.ok(['live_content','already_published'].includes(status));
    assert.ok(!keys.has(keyword.toLowerCase()),'Duplicate keyword mapped twice: '+keyword);
    keys.add(keyword.toLowerCase());
    if(role==='primary')primary.set(path,(primary.get(path)||0)+1);
  }
  assert.deepEqual(Array.from(primary.entries()),[['/',1],['/pricing',1],['/api-docs',1]]);
  assert.equal(raw.filter(x=>['/','/pricing','/api-docs'].includes(x[2])).length,12);
  assert.equal(raw.filter(x=>x[3]==='supporting').length,3);
});

test('homepage, pricing and documentation answer search intent without changing URLs or billing behavior',()=>{
  const homepage=(read('apps/web/components/relay-home.tsx') + read('apps/web/components/relay-home-interactive.tsx'));
  const pricing=read('apps/web/app/pricing/page.tsx');
  const docs=read('apps/web/app/docs/page.tsx');
  const registry=read('apps/web/lib/public-pages.ts');
  assert.match(homepage,/Build a WhatsApp REST API integration around your existing number/);
  assert.match(homepage,/signed webhook events/);
  assert.match(homepage,/WhatsApp API integration guides for your stack/);
  assert.match(homepage,/<PricingSection\/>/);
  assert.match(homepage,/api<Plan\[]>\('\/public\/plans'\)/,'Pricing must remain fetched from the live API');
  assert.match(pricing,/<PricingSection standalone\s*\/>/);
  assert.match(pricing,/What does a WhatsApp API cost\?/);
  assert.match(pricing,/Meta WhatsApp Business Platform charges follow a different pricing model/);
  assert.match(pricing,/RelayWA does not bill separately for each message/);
  assert.match(pricing,/does not supply official Cloud API access/);
  assert.match(docs,/<h1>WhatsApp REST API documentation/);
  assert.match(docs,/WhatsApp API integration docs to send messages from your backend/);
  assert.match(docs,/id="messages".*title="Send WhatsApp messages with the REST API"/);
  assert.match(docs,/id="webhooks".*title="WhatsApp API webhooks"/);
  assert.match(docs,/Node.js, Laravel, Python and \.NET/);
  assert.match(docs,/There is no outbound Redis queue, randomized gap, or automatic retry/);
  assert.match(registry,/path: '\/api-docs'/);
  assert.doesNotMatch(registry,/\bkeywords\s*:/,'Do not invent meta keywords that Google ignores');
});

test('canonical, sitemap and private route protections stay centralized',()=>{
  const metadata=read('apps/web/lib/seo.ts');
  const sitemap=read('apps/web/app/sitemap.ts');
  const docsPage=read('apps/web/app/api-docs/page.tsx');
  assert.match(metadata,/marketingPageMetadata\(path: string\)/);
  assert.match(metadata,/alternates: \{ canonical: url \}/);
  assert.match(metadata,/robots: \{ index: true, follow: true \}/);
  assert.match(sitemap,/publicPages, editorialPages/);
  assert.match(docsPage,/marketingPageMetadata\('\/api-docs'\)/);
  assert.doesNotMatch(sitemap.replace(/\/\/[^\n]+/g,''),/countries\/|locales|hreflang/);
});
