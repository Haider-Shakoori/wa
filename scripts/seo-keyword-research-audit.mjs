#!/usr/bin/env node
/**
 * Offline research-only auditor. NEVER publishes foreign-language keywords,
 * metadata, translated routes, or claim of search volume without a source.
 *
 * Optional verified GSC export:
 * node scripts/seo-keyword-research-audit.mjs --gsc=/path/to/export.csv --period=2026-09-01..2026-09-30
 *
 * GSC file must have columns country_iso,query,clicks,impressions.
 * Country accepts ISO2, ISO3 or full country name, and data is exact-matched
 * to the approved research hypotheses (no fuzzy attribution).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const corpusUrl = new URL('docs/seo/local-language-keyword-hypotheses.csv', root);
const registryUrl = new URL('apps/web/lib/public-pages.ts', root);
const marketsUrl = new URL('apps/web/lib/international-seo.ts', root);

export const expectedColumns = [
  'country_iso','research_locale','keyword_hypothesis','english_meaning','intent',
  'existing_english_url','query_evidence','native_language_review',
  'local_serp_review','monthly_search_volume','ranking_difficulty',
  'conversion_data','publication_decision',
];

export const countries = Object.freeze({
  IN: ['IND', 'India'], BR: ['BRA', 'Brazil'], ID: ['IDN', 'Indonesia'],
  MX: ['MEX', 'Mexico'], CO: ['COL', 'Colombia'], NG: ['NGA', 'Nigeria'],
  AE: ['ARE', 'United Arab Emirates'], PK: ['PAK', 'Pakistan'],
  SA: ['SAU', 'Saudi Arabia'], ZA: ['ZAF', 'South Africa'],
  ES: ['ESP', 'Spain'], DE: ['DEU', 'Germany'], GB: ['GBR', 'United Kingdom'],
});
const allowedIntents = new Set(['commercial','developer','informational','pricing']);

export function parseCsv(value) {
  if (value.charCodeAt(0) === 0xfeff) value = value.slice(1);
  const rows = [];
  let row = [], cell = '', quoted = false, atFieldStart = true;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quoted) {
      if (char === '"' && value[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && atFieldStart) { quoted = true; atFieldStart = false; continue; }
    if (char === ',') { row.push(cell); cell = ''; atFieldStart = true; continue; }
    if (char === '\n') { row.push(cell); if (row.some(x => x !== '')) rows.push(row); row=[]; cell=''; atFieldStart=true; continue; }
    if (char === '\r' && value[i+1] === '\n') continue;
    if (char === '"') throw new Error('Unexpected quote in unquoted CSV field');
    cell += char; atFieldStart = false;
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function normalizeCountry(input) {
  const value = input.trim().toLowerCase();
  for (const [code,[iso3,name]] of Object.entries(countries)) {
    if ([code.toLowerCase(),iso3.toLowerCase(),name.toLowerCase()].includes(value)) return code;
  }
  return null;
}

export function validateKeywordCorpus(csv, publishedPaths, catalogCountries=Object.keys(countries)) {
  const [head,...values]=parseCsv(csv);
  assert.deepEqual(head, expectedColumns, 'Keyword data schema differs from audited English-only format');
  const countryCounts = new Map();
  const languageCodes = new Set(), keys = new Set();
  const entries=values.map((row, index) => {
    assert.equal(row.length,expectedColumns.length,'Invalid field count on CSV row '+(index+2));
    const item=Object.fromEntries(head.map((key,i)=>[key,row[i]]));
    const code=item.country_iso;
    assert.ok(catalogCountries.includes(code),'Unknown country '+code);
    assert.match(item.research_locale,/^[a-z]{2,3}-[A-Z]{2}$/);
    assert.ok(item.research_locale.endsWith('-'+code),'Locale does not match market '+code);
    assert.ok(item.keyword_hypothesis.trim().length>=5,'Missing keyword text');
    assert.ok(item.english_meaning.trim().length>=5,'Missing English meaning');
    assert.ok(allowedIntents.has(item.intent),'Unexpected intent');
    assert.ok(publishedPaths.includes(item.existing_english_url),'Target must be already-published English canonical');
    assert.equal(item.query_evidence,'not_measured','Hypothesis cannot masquerade as observed query');
    assert.equal(item.native_language_review,'pending','Do not imply native review completion');
    assert.equal(item.local_serp_review,'pending','Do not imply local SERP review completed');
    assert.equal(item.monthly_search_volume,'unknown','Do not invent monthly search volume');
    assert.equal(item.ranking_difficulty,'unknown','Do not invent keyword difficulty');
    assert.equal(item.conversion_data,'unknown','Do not invent conversions');
    assert.equal(item.publication_decision,'research_only','Never treat data as permission to publish');
    assert.ok(!/[<>]/.test(item.keyword_hypothesis),'Do not store markup in keyword candidate');
    const key=code+'/'+item.research_locale+'/'+item.keyword_hypothesis.toLocaleLowerCase('en');
    assert.ok(!keys.has(key),'Duplicate country-locale-query hypothesis '+key);
    keys.add(key);
    countryCounts.set(code,(countryCounts.get(code)||0)+1);
    languageCodes.add(item.research_locale);
    return item;
  });
  for(const c of catalogCountries) assert.ok(countryCounts.has(c),'Missing country '+c);
  return {
    entries,
    summary: {
      researchHypotheses:entries.length,
      researchedCountries:countryCounts.size,
      researchLocales:languageCodes.size,
      foreignLanguageHypotheses:entries.filter(r=>!r.research_locale.startsWith('en-')).length,
      measuredSearchVolumeRows:0, verifiedNativeReviewRows:0, publishedForeignLanguagePages:0,
    },
  };
}

export function auditGscExport(entries, csv, period) {
  assert.match(period,/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/,'Explicit measured GSC date period is required');
  const [head,...rows]=parseCsv(csv);
  for(const required of ['country_iso','query','clicks','impressions']) {
    assert.ok(head.includes(required),'GSC normalized CSV must contain '+required);
  }
  const hypotheses=new Map(entries.map(x=>[x.country_iso+'|'+x.keyword_hypothesis.toLocaleLowerCase('en').trim(),x]));
  const results=new Map();
  let matchedRows=0;
  for(const row of rows) {
    assert.equal(row.length,head.length,'Invalid GSC export field count');
    const item=Object.fromEntries(head.map((key,i)=>[key,row[i]]));
    const iso=normalizeCountry(item.country_iso);
    if(!iso) continue;
    const hits=Number(item.clicks),shows=Number(item.impressions);
    assert.ok(Number.isSafeInteger(hits)&&hits>=0,'GSC clicks must be non-negative integers');
    assert.ok(Number.isSafeInteger(shows)&&shows>=hits,'GSC impressions must be >= clicks');
    const key=iso+'|'+item.query.toLocaleLowerCase('en').trim();
    if(!hypotheses.has(key)) continue;
    const previous=results.get(key)||{country_iso:iso,clicks:0,impressions:0};
    previous.clicks+=hits; previous.impressions+=shows;
    results.set(key,previous);matchedRows++;
  }
  const byCountry={};
  for(const r of results.values()){
    const v=byCountry[r.country_iso]||{matchedHypotheses:0,clicks:0,impressions:0};
    v.matchedHypotheses++;v.clicks+=r.clicks;v.impressions+=r.impressions;
    byCountry[r.country_iso]=v;
  }
  return {datePeriod:period,source:'user-provided-normalized-Google-Search-Console-export',matchedRows,matchedUniqueHypotheses:results.size,byCountry,scope:'Exact query matches only. Incomplete/anonymized GSC query data is excluded; not search volume, rankings or paid attribution.'};
}

export function auditRepository() {
  const registry=readFileSync(registryUrl,'utf8');
  const markets=readFileSync(marketsUrl,'utf8');
  const paths=[...registry.matchAll(/path: '([^']+)'/g)].map(x=>x[1]);
  const marketCodes=[...markets.matchAll(/\biso: '([A-Z]{2})'/g)].map(x=>x[1]);
  assert.deepEqual([...marketCodes].sort(),Object.keys(countries).sort(),'Research country registry mismatch');
  assert.deepEqual(paths,['/','/pricing','/api-docs','/help'],'Only the original four English routes should be SEO published');
  const data=validateKeywordCorpus(readFileSync(corpusUrl,'utf8'),paths,marketCodes);
  const layout=readFileSync(new URL('apps/web/app/layout.tsx',root),'utf8');
  const seo=readFileSync(new URL('apps/web/lib/seo.ts',root),'utf8');
  assert.match(layout,/<html lang="en"/);
  assert.doesNotMatch(seo,/keywords\s*:/,'Do not stuff metadata keywords');
  assert.doesNotMatch(seo,/languages\s*:/,'Do not publish unbuilt hreflang alternates');
  return data;
}

async function cli() {
  const data=auditRepository();
  const args=process.argv.slice(2);
  const gscArg=args.find(s=>s.startsWith('--gsc='));
  const periodArg=args.find(s=>s.startsWith('--period='));
  if(args.some(s=>!s.startsWith('--gsc=')&&!s.startsWith('--period='))) {
    throw new Error('Only --gsc=<CSV path> and --period=YYYY-MM-DD..YYYY-MM-DD are supported');
  }
  const observed=gscArg?auditGscExport(data.entries,readFileSync(gscArg.slice(6),'utf8'),periodArg?.slice(9)||''):null;
  if(!gscArg&&periodArg)throw new Error('--period requires --gsc');
  console.log(JSON.stringify({
    kind:'relaywa-batch-08-research-audit',
    ...data.summary,
    publishedWebsiteLanguage:'en',
    publicRoutes:['/','/pricing','/api-docs','/help'],
    evidenceNote:'All stored local-language terms are hypotheses pending native review and SERP/search demand verification. Their English URL mapping is research only; no foreign-language page optimization or rankings implied.',
    gscObservation:observed??'not available; no GSC property data accessed',
  },null,2));
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  cli().catch(e=>{console.error(e);process.exitCode=1;});
}
