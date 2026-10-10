import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = '.lighthouseci';
let entries = [];
try { entries = readdirSync(directory).filter(name=>name.endsWith('.json')); }
catch { console.log('No Lighthouse report directory found.'); }
const reports = [];
for(const name of entries) {
  try {
    const obj = JSON.parse(readFileSync(join(directory,name),'utf8'));
    if(!obj.categories?.performance || !obj.finalUrl) continue;
    reports.push(obj);
  } catch {}
}
if(!reports.length) {
  console.log('Lighthouse reports not available; refer to workflow status and artifacts.');
} else {
  const summaries = [];
  for(const report of reports) {
    const url = new URL(report.finalUrl);
    const failingA11y = Object.values(report.audits??{})
      .filter(a=>a && typeof a==='object' && a.score!==null && a.score<1 &&
        a.details?.type==='table' && (a.details?.items?.length??0)>0 &&
        (report.categories.accessibility.auditRefs??[]).some(ref=>ref.id===a.id))
      .map(a=>a.id).slice(0,8);
    summaries.push({
      page:url.pathname,
      performance:Math.round((report.categories.performance.score??0)*100),
      accessibility:Math.round((report.categories.accessibility.score??0)*100),
      seo:Math.round((report.categories.seo.score??0)*100),
      lcpMs:Math.round(report.audits['largest-contentful-paint']?.numericValue??0),
      cls:Math.round((report.audits['cumulative-layout-shift']?.numericValue??0)*1000)/1000,
      totalBlockingTimeMs:Math.round(report.audits['total-blocking-time']?.numericValue??0),
      failingAccessibilityAudits:failingA11y,
    });
  }
  console.log('RELAYWA_LAB_LIGHTHOUSE_REPORTS='+JSON.stringify(summaries));
  const lines=['### RelayWA mobile Lighthouse (local CI build)','',
    '| Route | Perf | A11y | SEO | LCP (ms) | CLS | TBT (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...summaries.map(s=>`| ${s.page} | ${s.performance} | ${s.accessibility} | ${s.seo} | ${s.lcpMs} | ${s.cls} | ${s.totalBlockingTimeMs} |`),
    '', '**Failed accessibility audit IDs by run**',
    ...summaries.map(s=>`- ${s.page}: ${s.failingAccessibilityAudits.join(', ')||'None reported'}`),
    '', 'Scores are simulated GitHub Chrome lab reports, **not** real-user Core Web Vitals.',
  ];
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
