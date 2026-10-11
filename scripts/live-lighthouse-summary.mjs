import { readFileSync, readdirSync } from 'node:fs';
const dir='.lighthouseci';
let names=[];
try {names=readdirSync(dir).filter(name=>name.endsWith('.json'));}catch{}
const reports=[];
for(const name of names) {
 try {
  const r=JSON.parse(readFileSync(dir+'/'+name,'utf8'));
  if (!r.finalUrl?.startsWith('https://relaywa.com/')||!r.categories?.performance) continue;
  const x=r.audits??{};
  const n=x['network-requests']?.details?.items??[];
  const protocols={};
  for(const item of n)if(item.protocol)protocols[item.protocol]=(protocols[item.protocol]||0)+1;
  const metric=id=>Math.round(x[id]?.numericValue??0);
  reports.push({
   route:new URL(r.finalUrl).pathname,
   score:Math.round(r.categories.performance.score*100),
   fcpMs:metric('first-contentful-paint'),
   lcpMs:metric('largest-contentful-paint'),
   speedIndexMs:metric('speed-index'),
   tbtMs:metric('total-blocking-time'),
   cls:Math.round((x['cumulative-layout-shift']?.numericValue??0)*1000)/1000,
   renderBlockingMs:metric('render-blocking-resources'),
   networkProtocols:protocols,
  });
 }catch(e){console.log('Skipping unreadable Lighthouse JSON:',name);}
}
if(!reports.length){console.error('No live RelayWA Lighthouse reports found');process.exitCode=1;}
console.log('RELAYWA_LIVE_LIGHTHOUSE_REPORTS='+JSON.stringify(reports));
