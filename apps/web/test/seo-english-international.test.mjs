import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
function moduleFromSource(file, modules={}) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports, URL,
    require: (name) => {
      assert.ok(name in modules, `unexpected dependency ${name}`);
      return modules[name];
    },
  }, { filename:file });
  return exports;
}

const catalog = moduleFromSource('lib/international-seo.ts');
const registry = moduleFromSource('lib/public-pages.ts');

test('13 researched countries stay English-only research, never sitemap or indexable drafts', () => {
  assert.equal(catalog.publicLanguage, 'en');
  assert.equal(catalog.researchMarkets.length, 13);
  assert.equal(catalog.researchMarkets.filter(m=>m.wave==='initial').length, 8);
  assert.equal(catalog.researchMarkets.filter(m=>m.wave==='research').length, 5);
  assert.equal(new Set(catalog.researchMarkets.map(m=>m.iso)).size, 13);
  assert.equal(new Set(catalog.researchMarkets.map(m=>m.slug)).size, 13);
  assert.equal(catalog.proposedEnglishCountryPath('india'), '/countries/india');
  assert.equal(catalog.proposedEnglishCountryPath('united-kingdom'), '/countries/united-kingdom');
  assert.throws(()=>catalog.proposedEnglishCountryPath('unknown'), /Unknown country market/);
  assert.deepEqual(Array.from(registry.publicPages, x=>x.path), ['/', '/pricing','/api-docs','/help']);
  for(const m of catalog.researchMarkets) {
    assert.equal(registry.isIndexablePublicPath(catalog.proposedEnglishCountryPath(m.slug)),false);
  }
});

test('country publication rules reject short, unverified, machine-duplicated boilerplate', () => {
  const draft = {
    market:'india', language:'en',
    title:'RelayWA WhatsApp REST API integrations for India',
    description:'Detailed developer-facing examples of WhatsApp QR-linked session integrations for Indian applications and REST webhooks.',
    primaryKeyword:'WhatsApp REST API India',
    originalContent:Array.from({length:185},(_,i)=>`word${i}`).join(' '),
    evidenceUrls:['https://www.example.org/integrations', 'https://www.example.org/market'],
    uniqueReason:'This researched use case differs from global content with a verifiable integration workflow for an India-based developer.',
    reviewedBy:'SEO/editorial reviewer', reviewedAt:'2026-10-11',
    productClaimsVerified:true, livePageVerified:true,
  };
  assert.deepEqual(Array.from(catalog.validateEnglishCountryPublication(draft)), []);
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, language:'pt-BR' }).includes('site language must be English'));
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, originalContent:'Copy paste generic content' })
    .includes('insufficient unique substantive content'));
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, evidenceUrls:[] })
    .includes('at least two HTTPS evidence links required'));
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, livePageVerified:false })
    .includes('published route not yet verified'));
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, productClaimsVerified:false })
    .includes('product availability/claims not verified'));
  assert.ok(catalog.validateEnglishCountryPublication({ ...draft, reviewedBy:'', reviewedAt:'' })
    .includes('editorial reviewer and review date required'));
});

test('English candidate keywords cover exactly researched markets and map to existing global URLs', () => {
  const rows=readFileSync(new URL('../../../docs/seo/english-country-keyword-candidates.csv',import.meta.url),'utf8')
    .trimEnd().split(/\r?\n/).map(line=>[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replaceAll('""','"')));
  const [header, ...data] = rows;
  assert.equal(header.length, 8);
  assert.equal(data.length, 26);
  const codes=new Set(catalog.researchMarkets.map(m=>m.iso));
  for(const cells of data) {
    assert.equal(cells.length,8);
    assert.ok(codes.has(cells[0]), `unregistered country ${cells[0]}`);
    assert.ok(catalog.researchMarkets.some(m=>m.slug===cells[1]));
    assert.match(cells[2], /^[\x20-\x7E]+$/);
    assert.ok(registry.isIndexablePublicPath(cells[4]), `candidate must target existing English page: ${cells[4]}`);
    assert.equal(cells[5],'unknown');
    assert.equal(cells[6],'unknown');
    assert.equal(cells[7],'unverified');
  }
  for(const code of codes) assert.equal(data.filter(r=>r[0]===code).length,2);
});

test('no extra hreflang, translation router, geo redirect or locale switch on English-only site',()=>{
  const rootLayout=read('app/layout.tsx');
  assert.match(rootLayout, /<html lang="en"/);
  const seo=read('lib/seo.ts');
  assert.doesNotMatch(seo,/languages:\s*\{/);
  const sitemap=read('app/sitemap.ts');
  assert.doesNotMatch(sitemap,/alternates\s*:/);
  const home=read('app/page.tsx');
  assert.match(home,/inLanguage:publicLanguage/);
  const config=read('next.config.ts');
  assert.doesNotMatch(config,/i18n:|localeDetection:|accept-language|geoip-country|x-vercel-ip-country/i);
  const proxy=read('proxy.ts');
  assert.doesNotMatch(proxy,/NextResponse\.redirect|NextResponse\.rewrite/);
  assert.match(read('components/google-analytics.tsx'),/isIndexablePublicPath/);
});

test('production smoke prevents unpublished English country URLs, translations, and geo redirects',()=>{
  const smoke=readFileSync(new URL('../../../scripts/seo-perf-budget.mjs',import.meta.url),'utf8');
  for(const phrase of ['/countries/india','/countries/brazil','/pt-br','/es','/ar','accept-language']){
    assert.ok(smoke.includes(phrase),phrase);
  }
  assert.match(smoke,/noindex/);
});
