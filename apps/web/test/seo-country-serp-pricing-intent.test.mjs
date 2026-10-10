import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { auditRepo,validateEvidence,columns } from '../../../scripts/seo-country-serp-audit.mjs';
import { parseCsv } from '../../../scripts/seo-keyword-research-audit.mjs';

const root=new URL('../../../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const csv=read('docs/seo/batch-09-country-serp-evidence.csv');

test('SERP review covers all 14 markets with documented source, query and original URL',()=>{
  const {items,summary}=auditRepo();
  assert.equal(items.length,14);
  assert.deepEqual(summary,{countries:14,heldCountryPages:14,approvedCountryPages:0,observationsAreSampleOnly:true});
  assert.equal(items.find(x=>x.country_iso==='US').sample_search_query,'whatsapp api pricing providers plans official Meta pricing alternatives');
  assert.equal(items.find(x=>x.country_iso==='DE').sample_query_language,'de');
  assert.equal(items.find(x=>x.country_iso==='BR').observed_result_language,'portuguese');
  assert.equal(items.find(x=>x.country_iso==='ID').observed_result_language,'indonesian');
  assert.ok(items.every(x=>x.gsc_country_data==='unavailable'));
  assert.ok(items.every(x=>x.localized_buyers_verified==='no'));
  assert.ok(items.every(x=>x.country_page_decision==='hold_country_page'));
});

test('sample labels cannot be escalated into rankings, real GSC measurements or country page approval',()=>{
  const mutate=(a,b)=>{assert.ok(csv.includes(a));return csv.replace(a,b);};
  assert.throws(()=>validateEvidence(mutate('"hold_country_page"','"publish"')),/Region page requires separate buyer evidence/);
  assert.throws(()=>validateEvidence(mutate('"unavailable"','"verified"')),/Do not claim a connected GSC report/);
  assert.throws(()=>validateEvidence(mutate('"no"','"yes"')),/Unique local buyer demand has not been verified/);
  assert.throws(()=>validateEvidence(mutate('"public_geo_targeted_search_sample"','"google_search_console"')),/Do not relabel public SERP samples/);
  assert.throws(()=>validateEvidence(mutate('"US"','"ZZ"')),/Unknown country/);
  assert.throws(()=>validateEvidence(mutate('"/pricing"','"/countries/usa"')),/May only map to existing English pages/);
  assert.throws(()=>validateEvidence(mutate('"https://developers.facebook.com/','"http://developers.facebook.com/')),/real HTTPS/);
});

test('evidence file remains an auditable, clean CSV and has no duplicated market',()=>{
  const [headers,...rows]=parseCsv(csv);
  assert.deepEqual(headers,columns);
  assert.equal(rows.length,14);
  assert.equal(new Set(rows.map(x=>x[0])).size,14);
  assert.ok(rows.every(x=>x[5].length>10));
  assert.ok(rows.every(x=>x[10].length>30));
});

test('pricing clarifies differences in *existing* server-rendered page, keeps trial/plans and docs links',()=>{
  const pricing=read('apps/web/app/pricing/page.tsx');
  const marketing=read('apps/web/components/relay-home.tsx');
  const docs=read('apps/web/app/docs/page.tsx');
  assert.match(pricing,/<PricingSection standalone/);
  assert.match(pricing,/id="pricing-model-heading"/);
  assert.match(pricing,/Meta's official Cloud API/);
  assert.match(pricing,/links an existing WhatsApp account by QR code/);
  assert.match(pricing,/RelayWA does not supply official Cloud API access/);
  assert.match(pricing,/href="https:\/\/whatsappbusiness.com\/products\/platform-pricing\/"/);
  assert.match(pricing,/rel="noopener noreferrer"/);
  assert.match(pricing,/href="\/api-docs#queue"/);
  assert.match(marketing,/Try one number for 7 days/);
  assert.match(docs,/There is no outbound Redis queue, randomized gap, or automatic retry/);
  assert.doesNotMatch(pricing,/\/countries\/|\/pt-br\/|\/de\/|\/es\//);
});

test('research is explicit about sampling limitations, not a fake Google top-ten crawl',()=>{
  const brief=read('docs/seo/batch-09-serp-intent-and-publishing-gates.md');
  assert.match(brief,/not.*exhaustive/i);
  assert.match(brief,/top 10 Google SERP/i);
  assert.match(brief,/Country landing pages held/);
  assert.match(brief,/Batch 09 remains open/);
  assert.match(brief,/Laravel transactional messaging workflow/);
  assert.match(brief,/Node\.js \+ webhook integration/);
  assert.match(brief,/official Meta Cloud API versus QR-linked sessions/i);
  assert.match(brief,/14-country/i);
});
