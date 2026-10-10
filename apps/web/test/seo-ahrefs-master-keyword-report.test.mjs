import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  auditRepo,validateMasterCsv,countries,approvedEnglishPaths
} from '../../../scripts/seo-master-keyword-audit.mjs';

const root=new URL('../../../',import.meta.url);
const csv=readFileSync(new URL('docs/seo/whatsapp-api-ahrefs-14-market-master.csv',root),'utf8');
const {records,summary}=auditRepo();
const find=(code,keyword)=>records.find(x=>x.country_iso===code&&x.keyword===keyword);

test('master contains 98 screenshot-observed country+keyword pairs, not 98 unique global search queries',()=>{
  assert.equal(records.length,98);
  assert.equal(summary.countries,14);
  assert.equal(Object.keys(countries).length,14);
  assert.equal(summary.countryKeywordPairs,98);
  assert.equal(summary.ahrefsSuggestionsShownAcrossAllCountryDatabases,22441);
  assert.deepEqual(summary.easyMainKeywordCountries,['BR','CO','DE','ES','MX','PK']);
  assert.ok(records.some(x=>x.country_iso==='US'));
  assert.ok(records.some(x=>x.country_iso==='PK'));
});

test('search volumes are Ahrefs reported buckets rather than invented absolute numbers',()=>{
  assert.deepEqual(new Set(records.map(x=>x.ahrefs_volume_bucket)),
    new Set(['>10000','>1000','>100','<100']));
  assert.equal(find('IN','whatsapp api').ahrefs_volume_bucket,'>10000');
  assert.equal(find('IN','whatsapp api').ahrefs_kd_label,'Hard');
  assert.equal(find('MX','whatsapp api').ahrefs_kd_label,'Easy');
  assert.equal(find('US','whatsapp api pricing').ahrefs_kd_label,'Easy');
  assert.equal(find('AE','whatsapp api pricing').ahrefs_kd_label,'Easy');
  assert.equal(find('SA','whatsapp api pricing').ahrefs_volume_bucket,'<100');
  assert.equal(find('DE','whatsapp api kosten').ahrefs_kd_label,'Easy');
  assert.equal(find('ID','cara membuat whatsapp api').ahrefs_volume_bucket,'>100');
  assert.equal(find('CO','whatsapp api precios').ahrefs_kd_label,'signup_gated');
  assert.equal(find('NG','whatsapp api cost per message').ahrefs_kd_label,'signup_gated');
  assert.equal(find('GB','whatsapp api send message').ahrefs_kd_label,'Easy');
});

test('official-only terms remain editorial hold, and local-language research cannot produce localized pages',()=>{
  assert.equal(find('BR','whatsapp api oficial').relaywa_product_fit,'official_only');
  assert.equal(find('BR','whatsapp api oficial').editorial_priority,'Hold');
  assert.equal(find('CO','whatsapp api cloud').editorial_priority,'Hold');
  assert.equal(find('MX','whatsapp api call').editorial_priority,'Hold');
  assert.equal(find('AE','whatsapp api call').relaywa_product_fit,'unsupported_unverified');
  for(const r of records){
    assert.ok(approvedEnglishPaths.includes(r.existing_english_target));
    assert.equal(r.evidence_status,'user_screenshot_bucket_only');
    assert.ok(!r.existing_english_target.includes('/countries/'));
    assert.ok(!r.existing_english_target.startsWith('/pt-'));
  }
  assert.equal(readFileSync(new URL('apps/web/app/layout.tsx',root),'utf8').includes('<html lang="en"'),true);
});

test('country, provenance and bucket validator rejects silent volume/SEO fabrication',()=>{
  const replaceOnce=(from,to)=>{assert.ok(csv.includes(from));return csv.replace(from,to);};
  assert.throws(()=>validateMasterCsv(replaceOnce('">10000"','"12000"')),/Only screenshot search volume buckets/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"Hard"','"7"')),/Do not fabricate numeric keyword difficulty/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"image(20261010-215056).png"','"fabricated.png"')),/Wrong screenshot provenance/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"user_screenshot_bucket_only"','"verified_search_volume"')),/Never imply verified exact search counts/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"/pricing"','"/countries/india"')),/No new or translated landing pages/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"US"','"XX"')),/Unsupported country/);
  assert.throws(()=>validateMasterCsv(replaceOnce('"official_only","/help","Hold"','"official_only","/help","P1"')),/Official-only or unsupported\/unverified capabilities must stay on editorial hold/);
});

test('CSV and report are independent of country pages and previous unverified keyword hypotheses',()=>{
  const registry=readFileSync(new URL('apps/web/lib/public-pages.ts',root),'utf8');
  const oldResearch=readFileSync(new URL('docs/seo/local-language-keyword-hypotheses.csv',root),'utf8');
  const newReport=readFileSync(new URL('docs/seo/whatsapp-api-master-keyword-report.md',root),'utf8');
  const screenshotRows=records.filter(x=>x.country_iso==='DE'&&x.keyword_language==='de');
  assert.ok(screenshotRows.length>=2);
  assert.match(oldResearch,/native_language_review/);
  assert.match(newReport,/14 countries/);
  assert.match(newReport,/Ahrefs/);
  assert.match(newReport,/not exact monthly volumes/i);
  assert.match(newReport,/no new country pages/i);
  assert.deepEqual([...registry.matchAll(/path: '(\/[^']*)'/g)].map(x=>x[1]),
    ['/','/pricing','/api-docs','/help']);
});