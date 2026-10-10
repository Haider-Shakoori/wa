import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  auditRepository, auditGscExport, countries,
  parseCsv, validateKeywordCorpus, expectedColumns, normalizeCountry,
} from '../../../scripts/seo-keyword-research-audit.mjs';

const root=new URL('../../../',import.meta.url);
const corpus=readFileSync(new URL('docs/seo/local-language-keyword-hypotheses.csv',root),'utf8');
const published=['/','/pricing','/api-docs','/help'];

test('41 candidate queries in native and English languages represent all thirteen researched markets',()=>{
  const {entries,summary}=auditRepository();
  assert.equal(summary.researchHypotheses,41);
  assert.equal(summary.researchedCountries,13);
  assert.equal(summary.researchLocales,16);
  assert.ok(summary.foreignLanguageHypotheses>=30);
  assert.equal(summary.measuredSearchVolumeRows,0);
  assert.equal(summary.verifiedNativeReviewRows,0);
  assert.equal(summary.publishedForeignLanguagePages,0);
  assert.deepEqual(Object.keys(countries).sort(),
    ['IN','BR','ID','MX','CO','NG','AE','PK','SA','ZA','ES','DE','GB'].sort());
  assert.ok(entries.some(x=>x.country_iso==='BR'&&x.research_locale==='pt-BR'));
  assert.ok(entries.some(x=>x.country_iso==='DE'&&x.research_locale==='de-DE'));
  assert.ok(entries.some(x=>x.country_iso==='SA'&&x.research_locale==='ar-SA'));
  assert.ok(entries.some(x=>x.country_iso==='NG'&&x.research_locale==='yo-NG'));
  assert.ok(entries.some(x=>x.country_iso==='ZA'&&x.research_locale==='zu-ZA'));
  assert.ok(entries.some(x=>x.country_iso==='GB'&&x.research_locale==='en-GB'));
});

test('UTF-8 local-language hypotheses and English interpretation round-trip through CSV reader',()=>{
  const data=parseCsv(corpus);
  assert.deepEqual(data[0],expectedColumns);
  assert.equal(data.length,42);
  const rawKeywords=data.slice(1).map(x=>x[2]);
  assert.ok(rawKeywords.includes('व्हाट्सएप एपीआई'));
  assert.ok(rawKeywords.includes('واٹس ایپ اے پی آئی'));
  assert.ok(rawKeywords.includes('واجهة برمجة تطبيقات واتساب'));
  assert.ok(rawKeywords.includes('API do WhatsApp'));
  assert.ok(rawKeywords.includes('WhatsApp API Schnittstelle'));
  assert.deepEqual(parseCsv('a,b\n"x,y","z""w"\n'),[['a','b'],['x,y','z"w']]);
  assert.throws(()=>parseCsv('"broken'),/Unterminated/);
});

test('multilingual research cannot silently register pages or bogus ranking/search volume claims',()=>{
  const replaceOnce=(old,next)=>{assert.ok(corpus.includes(old));return corpus.replace(old,next);};
  assert.throws(()=>validateKeywordCorpus(replaceOnce('"research_only"','"ready_to_publish"'),published),
    /Never treat data as permission to publish/);
  assert.throws(()=>validateKeywordCorpus(replaceOnce('"unknown"','"10000"'),published),
    /Do not invent monthly search volume/);
  assert.throws(()=>validateKeywordCorpus(replaceOnce('"pending"','"approved"'),published),
    /Do not imply native review completion/);
  assert.throws(()=>validateKeywordCorpus(replaceOnce('"/api-docs"','"/ar/whatsapp-api"'),published),
    /already-published English canonical/);
  assert.throws(()=>validateKeywordCorpus(replaceOnce('"IN"','"XX"'),published),
    /Unknown country/);
});

test('dated user-provided GSC export is matched precisely without invented volume or paid attribution',()=>{
  const {entries}=auditRepository();
  const sample=[
    'country_iso,query,clicks,impressions',
    'BR,API do WhatsApp,12,100',
    'BRA,API do WhatsApp,3,30',
    'IN,व्हाट्सएप एपीआई,5,40',
    'DE,unrelated query,40,400',
  ].join('\n');
  const result=auditGscExport(entries,sample,'2026-09-01..2026-09-30');
  assert.equal(result.datePeriod,'2026-09-01..2026-09-30');
  assert.equal(result.matchedRows,3);
  assert.equal(result.matchedUniqueHypotheses,2);
  assert.deepEqual(result.byCountry.BR,{matchedHypotheses:1,clicks:15,impressions:130});
  assert.deepEqual(result.byCountry.IN,{matchedHypotheses:1,clicks:5,impressions:40});
  assert.equal(result.byCountry.DE,undefined);
  assert.ok(result.scope.includes('not search volume'));
  assert.throws(()=>auditGscExport(entries,sample,''),/Explicit measured GSC date period/);
  assert.throws(()=>auditGscExport(entries,'country_iso,query,clicks\nBR,test,1','2026-09-01..2026-09-30'),
    /GSC normalized CSV must contain impressions/);
  assert.equal(normalizeCountry('United Kingdom'),'GB');
  assert.equal(normalizeCountry('gbr'),'GB');
  assert.equal(normalizeCountry('unknown'),null);
});

test('no multilingual keywords are inserted into indexable page metadata or hreflang',()=>{
  const registry=readFileSync(new URL('apps/web/lib/public-pages.ts',root),'utf8');
  const seo=readFileSync(new URL('apps/web/lib/seo.ts',root),'utf8');
  const layout=readFileSync(new URL('apps/web/app/layout.tsx',root),'utf8');
  const sitemap=readFileSync(new URL('apps/web/app/sitemap.ts',root),'utf8');
  const docs=readFileSync(new URL('apps/web/app/docs/page.tsx',root),'utf8');
  const filenames=[...registry.matchAll(/path: '([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(filenames,published);
  assert.match(layout,/<html lang="en"/);
  assert.doesNotMatch(seo,/keywords\s*:/);
  assert.doesNotMatch(sitemap,/alternates:\s*\{\s*languages/);
  assert.match(docs,/<h1>WhatsApp REST API documentation:/);
  assert.match(readFileSync(new URL('apps/web/components/google-analytics.tsx',root),'utf8'),
    /isIndexablePublicPath/);
});