#!/usr/bin/env node
/**
 * Validate chat-supplied Ahrefs screenshot observations: buckets, NOT exact volumes.
 * Read-only, no keyword import into the English public website.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './seo-keyword-research-audit.mjs';

export const columns = [
  'country_iso','country','keyword','keyword_language','ahrefs_volume_bucket',
  'ahrefs_kd_label','search_intent','relaywa_product_fit','existing_english_target',
  'editorial_priority','source_screenshot','evidence_status',
];
export const countries = Object.freeze({
  US:{name:'United States',ideas:3764,source:'image(20261010-215056).png'},
  IN:{name:'India',ideas:2855,source:'image(20261010-215659).png'},
  PK:{name:'Pakistan',ideas:1319,source:'image(20261010-215739).png'},
  BR:{name:'Brazil',ideas:2238,source:'image(20261010-215829).png'},
  ID:{name:'Indonesia',ideas:1615,source:'image(20261010-215857).png'},
  MX:{name:'Mexico',ideas:1424,source:'image(20261010-220108).png'},
  CO:{name:'Colombia',ideas:1189,source:'image(20261010-220142).png'},
  NG:{name:'Nigeria',ideas:814,source:'image(20261010-220211).png'},
  AE:{name:'United Arab Emirates',ideas:1163,source:'image(20261010-220313).png'},
  SA:{name:'Saudi Arabia',ideas:995,source:'image(20261010-220340).png'},
  ZA:{name:'South Africa',ideas:960,source:'image(20261010-220413).png'},
  ES:{name:'Spain',ideas:1274,source:'image(20261010-220456).png'},
  DE:{name:'Germany',ideas:1225,source:'image(20261010-220523).png'},
  GB:{name:'United Kingdom',ideas:1606,source:'image(20261010-220551).png'},
});
const intents=new Set(['commercial','pricing','developer','comparison','informational','official_api']);
const fits=new Set(['direct','conditional','comparison_only','official_only','unsupported_unverified']);
const priorities=new Set(['P1','P2','P3','Hold']);
const kd=new Set(['Easy','Medium','Hard','N/A','not_shown','signup_gated']);
const buckets=new Set(['>10000','>1000','>100','<100']);
export const approvedEnglishPaths=Object.freeze(['/','/pricing','/api-docs','/help']);
const root=new URL('../',import.meta.url);

export function validateMasterCsv(csv){
  const [head,...data]=parseCsv(csv);
  assert.deepEqual(head,columns,'Unexpected keyword master column order');
  assert.equal(data.length,98,'Expected 98 screenshot-observed country+keyword pairs');
  const unique=new Set();
  const countriesSeen=new Map();
  const records=data.map((r,i)=>{
    assert.equal(r.length,columns.length,'Invalid CSV column count on row '+(i+2));
    const item=Object.fromEntries(columns.map((k,index)=>[k,r[index]]));
    const market=countries[item.country_iso];
    assert.ok(market,'Unsupported country '+item.country_iso);
    assert.equal(item.country,market.name,'Incorrect country name');
    assert.equal(item.source_screenshot,market.source,'Wrong screenshot provenance');
    assert.equal(item.evidence_status,'user_screenshot_bucket_only','Never imply verified exact search counts');
    assert.ok(item.keyword.trim().length>4,'Missing keyword');
    assert.match(item.keyword_language,/^(en|pt|id|es|de)$/,'Unexpected locale (not site language)');
    assert.ok(buckets.has(item.ahrefs_volume_bucket),'Only screenshot search volume buckets are permissible');
    assert.ok(kd.has(item.ahrefs_kd_label),'Do not fabricate numeric keyword difficulty');
    assert.ok(intents.has(item.search_intent),'Unknown query intent');
    assert.ok(fits.has(item.relaywa_product_fit),'Unknown product compatibility');
    assert.ok(approvedEnglishPaths.includes(item.existing_english_target),'No new or translated landing pages');
    assert.ok(priorities.has(item.editorial_priority),'Editorial priority outside rubric');
    if(['official_only','unsupported_unverified'].includes(item.relaywa_product_fit)){
      assert.equal(item.editorial_priority,'Hold','Official-only or unsupported/unverified capabilities must stay on editorial hold');
    }
    const key=item.country_iso+'|'+item.keyword.toLocaleLowerCase('en');
    assert.ok(!unique.has(key),'Duplicate market keyword '+key);
    unique.add(key);
    countriesSeen.set(item.country_iso,(countriesSeen.get(item.country_iso)||0)+1);
    return item;
  });
  assert.equal(countriesSeen.size,14);
  for(const code of Object.keys(countries))assert.equal(countriesSeen.get(code),7,'Expected 7 selected, user-supplied keywords for '+code);
  const main=records.filter(x=>x.keyword==='whatsapp api');
  assert.equal(main.length,14,'Missing WhatsApp API benchmark country');
  const easy=main.filter(x=>x.ahrefs_kd_label==='Easy').map(x=>x.country_iso).sort();
  assert.deepEqual(easy,['BR','CO','DE','ES','MX','PK']);
  assert.equal(records.find(x=>x.country_iso==='IN'&&x.keyword==='whatsapp api').ahrefs_volume_bucket,'>10000');
  assert.equal(records.find(x=>x.country_iso==='AE'&&x.keyword==='whatsapp api pricing').ahrefs_kd_label,'Easy');
  assert.equal(records.find(x=>x.country_iso==='US'&&x.keyword==='whatsapp api pricing').ahrefs_kd_label,'Easy');
  const summary={
    countryKeywordPairs:records.length,
    countries:countriesSeen.size,
    ahrefsSuggestionsShownAcrossAllCountryDatabases:Object.values(countries).reduce((a,c)=>a+c.ideas,0),
    easyMainKeywordCountries:easy,
    note:'Ahrefs volume buckets and KD labels are third-party estimates transcribed from 14 user screenshots, not unique global keywords or exact traffic forecasts.',
  };
  return {records,summary};
}

export function auditRepo(){
  const csv=readFileSync(new URL('docs/seo/whatsapp-api-ahrefs-14-market-master.csv',root),'utf8');
  const data=validateMasterCsv(csv);
  const source=readFileSync(new URL('apps/web/lib/public-pages.ts',root),'utf8');
  const currentPaths=[...source.matchAll(/path: '(\/[^']*)'/g)].map(m=>m[1]);
  assert.deepEqual(currentPaths,approvedEnglishPaths,'Do not publish country landing pages during research');
  const html=readFileSync(new URL('apps/web/app/layout.tsx',root),'utf8');
  assert.match(html,/<html lang="en"/,'English-only publication rule');
  return data;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try {
    const result=auditRepo();
    console.log(JSON.stringify({kind:'relaywa-ahrefs-14-market-master',...result.summary},null,2));
  }catch(error){
    console.error(error);
    process.exitCode=1;
  }
}
