// Read-only release preflight for an existing, fully staged Cloudflare Worker version set.
const expect={
  'relaywa-platform':{
    previous:'1d610cf7-56d1-450a-92ff-12777467291a',
    candidate:'3eb22452-a378-4e77-a201-53f3b62e939d',
    required:['function updateWebsitePurchaseAvailability','function deleteUnusedWebsitePlan','/platform/website-plans/:code/availability','available_for_purchase']
  },
  'relaywa-api':{
    previous:'d024b12d-a3ff-4c2d-9410-3e842094e01b',
    candidate:'122829c2-db1d-49e1-8038-f3bc355b2031',
    required:['available_for_purchase = 1','unavailable for new purchases','function en(']
  },
  'relaywa-web':{
    previous:'7ed59153-0fd7-4ee0-82ab-e1460729724d',
    candidate:'96b215ef-8208-4e3f-804d-bc74918d1053',
    required:['Delete unused plan','Disable new purchases','Save website plan']
  }
};
const id=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Missing Cloudflare access');
const root='https://api.cloudflare.com/client/v4/accounts/'+id;
const headers={authorization:'Bearer '+token};
async function cf(url,opts={}){
  const response=await fetch(url,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!data.success||!response.ok)throw Error('Cloudflare HTTP '+response.status+' codes '+JSON.stringify(data.errors?.map(e=>e.code)));
  return data.result;
}
const dbs=await cf(root+'/d1/database?per_page=100');
const db=dbs.filter(x=>x.name==='relaywa');
if(db.length!==1)throw Error('RelayWA D1 database match failed');
async function q(sql){const result=await cf(root+'/d1/database/'+db[0].uuid+'/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql})});return result?.[0]?.results??[];}
const user=await q("SELECT lower(email) AS email,is_platform_admin AS admin FROM users WHERE lower(email) IN ('haider@relaywa.com','mr.qkay@relaywa.com')");
if(user.length!==2||user.some(r=>r.admin!==1))throw Error('Protected administrators not available');
const columns=await q("SELECT sql FROM sqlite_master WHERE type='table' AND name='subscription_plans'");
const hasFlag=String(columns[0]?.sql??'').includes('available_for_purchase');
console.log('D1_AVAILABILITY_COLUMN '+hasFlag);
const mark=await cf(root+'/d1/database/'+db[0].uuid+'/time_travel/bookmark');
if(!mark.bookmark)throw Error('D1 Time Travel unavailable');
console.log('D1_TIME_TRAVEL_AVAILABLE');
for(const [name,entry] of Object.entries(expect)){
  const history=await cf(root+'/workers/scripts/'+name+'/deployments');
  const active=history.deployments?.[0]?.versions?.find(x=>x.percentage===100)?.version_id;
  if(active!==entry.previous)throw Error('Live '+name+' version changed from known safe version');
  const script=await fetch(root+'/workers/scripts/'+name,{headers,signal:AbortSignal.timeout(30000)});
  if(!script.ok)throw Error('Cannot inspect '+name+' modules');
  const form=await script.formData();
  const part=form.get(name==='relaywa-web'?'ssr/_next/static/page-Gh6edkTR.js':'index.js');
  if(!part)throw Error('Staged version missing target entrypoint '+name);
  const source=typeof part==='string'?part:await part.text();
  for(const needle of entry.required)if(!source.includes(needle))throw Error('Missing expected '+name+' patch marker '+needle);
  if(name==='relaywa-web'){
    if(!form.has('recovery-assets.mjs')||!form.has('ssr/index.js'))throw Error('Vinext modules missing from candidate');
  }
  console.log('CANDIDATE_READY '+name+' '+entry.candidate+' ACTIVE_UNCHANGED '+entry.previous+' MODULE_COUNT '+Array.from(form.keys()).length);
}
console.log('RELAYWA_PLAN_RELEASE_PREFLIGHT_OK');
