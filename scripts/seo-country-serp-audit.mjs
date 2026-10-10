#!/usr/bin/env node
/** Research-only SERP sample gate. A public search sample is not Google Search Console data. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './seo-keyword-research-audit.mjs';
import { countries, approvedEnglishPaths } from './seo-master-keyword-audit.mjs';

export const columns=[
  'country_iso','country','sample_search_query','sample_query_language',
  'observed_example_url','observed_example_type','observed_result_category',
  'observed_result_language','recommended_existing_english_url','country_page_decision',
  'observation','source','observation_date','gsc_country_data','localized_buyers_verified',
];
const langs=new Set(['en','pt','id','es','de']);
const resultLangs=new Set(['english','portuguese','indonesian','spanish','german']);
const categories=new Set(['official-meta','official-platform-coverage','regional-provider']);
const root=new URL('../',import.meta.url);

export function validateEvidence(csv) {
  const [head,...rows]=parseCsv(csv);
  assert.deepEqual(head,columns,'Unexpected country SERP data schema');
  assert.equal(rows.length,14,'All fourteen research markets require a sample');
  const seen=new Set();
  const items=rows.map((row,i)=>{
    assert.equal(row.length,columns.length,'Wrong CSV column count row '+(i+2));
    const obj=Object.fromEntries(columns.map((k,j)=>[k,row[j]]));
    assert.ok(Object.hasOwn(countries,obj.country_iso),'Unknown country');
    assert.equal(obj.country,countries[obj.country_iso].name,'Country mismatch');
    assert.ok(!seen.has(obj.country_iso),'Duplicate SERP country');seen.add(obj.country_iso);
    assert.ok(/whatsapp/i.test(obj.sample_search_query),'Sample needs a WhatsApp query');
    assert.ok(langs.has(obj.sample_query_language),'Unreviewed sample search language');
    assert.ok(resultLangs.has(obj.observed_result_language),'Unreviewed result language');
    const u=new URL(obj.observed_example_url);
    assert.equal(u.protocol,'https:','Evidence must link a real HTTPS public result');
    assert.ok(u.hostname.includes('.'),'Missing host');
    assert.ok(obj.observed_example_type.length>12,'Unclear result type');
    assert.ok(categories.has(obj.observed_result_category),'Unsupported result type');
    assert.ok(approvedEnglishPaths.includes(obj.recommended_existing_english_url),'May only map to existing English pages');
    assert.equal(obj.country_page_decision,'hold_country_page','Region page requires separate buyer evidence');
    assert.equal(obj.source,'public_geo_targeted_search_sample','Do not relabel public SERP samples GSC or Ahrefs');
    assert.equal(obj.observation_date,'2026-10-11');
    assert.equal(obj.gsc_country_data,'unavailable','Do not claim a connected GSC report');
    assert.equal(obj.localized_buyers_verified,'no','Unique local buyer demand has not been verified');
    assert.ok(obj.observation.length>30,'Each sample needs a specific reason');
    return obj;
  });
  assert.deepEqual([...seen].sort(),Object.keys(countries).sort());
  return {items,summary:{countries:14,heldCountryPages:14,approvedCountryPages:0,observationsAreSampleOnly:true}};
}

export function auditRepo() {
  const data=validateEvidence(readFileSync(new URL('docs/seo/batch-09-country-serp-evidence.csv',root),'utf8'));
  const registry=readFileSync(new URL('apps/web/lib/public-pages.ts',root),'utf8');
  const paths=[...registry.matchAll(/path: '(\/[^']*)'/g)].map(x=>x[1]);
  assert.deepEqual(paths,approvedEnglishPaths,'No unverified regional SEO routes');
  const html=readFileSync(new URL('apps/web/app/layout.tsx',root),'utf8');
  assert.match(html,/<html lang="en"/,'Marketing site language must remain English');
  const pricing=readFileSync(new URL('apps/web/app/pricing/page.tsx',root),'utf8');
  assert.match(pricing,/QR-linked API subscription vs\. Meta's official API pricing/);
  assert.match(pricing,/https:\/\/whatsappbusiness\.com\/products\/platform-pricing\//);
  assert.match(pricing,/RelayWA does not supply official Cloud API access/);
  assert.match(pricing,/PricingSection standalone/,'Keep actual dynamic price cards');
  assert.match(pricing,/href="\/api-docs#sessions"/);
  assert.match(pricing,/href="\/api-docs#queue"/);
  return data;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try {
    const d=auditRepo();
    console.log(JSON.stringify({kind:'relaywa-serp-country-gates',...d.summary},null,2));
  }catch(e){console.error(e);process.exitCode=1;}
}