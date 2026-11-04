import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
function registry() {
  const compiled = ts.transpileModule(read('lib/public-pages.ts'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const exports = {};
  runInNewContext(compiled,{exports});
  return exports;
}

const expected = [
  ['/whatsapp-api-qr-code','app/whatsapp-api-qr-code/page.tsx','QR','Linked devices'],
  ['/whatsapp-webhooks','app/whatsapp-webhooks/page.tsx','webhooks','HMAC-SHA256'],
  ['/guides/whatsapp-web-vs-cloud-api','app/guides/whatsapp-web-vs-cloud-api/page.tsx','Cloud API','official']
];

test('index only three additional intent routes, keep private and drafts unpublished',()=>{
  const r=registry();
  assert.equal(r.publicPages.length,4);
  assert.equal(r.editorialPages.length,4);
  assert.equal(r.intentPages.length,3);
  assert.equal(r.allPublishedPages.length,11);
  const paths=r.allPublishedPages.map(page=>page.path);
  assert.equal(new Set(paths).size,paths.length);
  for(const [path] of expected){
    const page=r.intentPages.find(x=>x.path===path);
    assert.ok(page,path);
    assert.equal(r.isIndexablePublicPath(path),true);
    assert.ok(page.title.length>=35&&page.title.length<=70);
    assert.ok(page.description.length>=110&&page.description.length<=180);
  }
  for(const path of ['/register','/dashboard','/checkout','/settings','/blog/draft']){
    assert.equal(r.isIndexablePublicPath(path),false,path);
  }
});

test('every new page uses canonical registry metadata, real workflow and accurate disclaimers',()=>{
  for(const [path,file,headline,evidence] of expected){
    const text=read(file);
    assert.ok(text.includes("marketingPageMetadata('"+path+"')"),file+' metadata');
    assert.ok(text.includes('canonicalUrl'),file+' canonical');
    assert.match(text,/<h1/);
    assert.ok(text.includes(headline),file+' heading keyword');
    assert.ok(text.includes(evidence),file+' proof');
    assert.match(text,/Linked devices|unofficial|unofficial WhatsApp Web/i);
    assert.match(text,/PublicHeader|PublicFooter/);
    assert.match(text,/schema\.org/);
    assert.doesNotMatch(text,/100% delivered|ban.proof|zero ban risk|official Meta.approved RelayWA/i);
  }
  assert.match(read('app/whatsapp-api-qr-code/page.tsx'),/no.+promise zero bans|no unofficial WhatsApp integration can promise/i);
  assert.match(read('app/whatsapp-webhooks/page.tsx'),/constant.time|constant-time/);
  assert.match(read('app/guides/whatsapp-web-vs-cloud-api/page.tsx'),/postman\.com\/meta\/whatsapp-business-platform/);
});

test('new pages are discoverable from marketing footer and auto-added to sitemap',()=>{
  const footer=read('components/relay-home.tsx');
  const sitemap=read('app/sitemap.ts');
  for(const [path] of expected)assert.ok(footer.includes('href="'+path+'"'),path+' missing footer link');
  assert.match(sitemap, /\.\.\.intentPages/);
  assert.match(read('lib/public-pages.ts'), /\.\.\.intentPages/);
  assert.ok(!read('app/robots.ts').includes('Disallow: /'));
});
