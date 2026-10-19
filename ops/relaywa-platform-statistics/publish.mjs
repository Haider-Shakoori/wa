// Activate only the validated RelayWA platform statistics versions, rollback on any failure.
const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Cloudflare credentials missing');
const base='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
const releases=[
 {name:'relaywa-platform',before:'3eb22452-a378-4e77-a201-53f3b62e939d',after:'0d3b9a31-06fc-4d54-9052-19e94c732bb0'},
 {name:'relaywa-web',before:'e8de7e2a-b4c8-4749-8102-34fac1b438a5',after:'d99bd498-677b-48ed-93c6-687019dfe439'}
];
async function cf(url,options={}){
 const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare error '+r.status+' '+JSON.stringify(j.errors?.map(e=>e.code)));return j.result;
}
async function active(name){
 const j=await cf(base+name+'/deployments');
 const v=j.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split '+name);
 return v[0].version_id;
}
async function activate(name,version,reason){
 await cf(base+name+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':reason}})});
 if(await active(name)!==version)throw Error('Deployment failed verification '+name);
}
for(const item of releases){
 if(await active(item.name)!==item.before)throw Error('Unexpected live version drift '+item.name);
 const v=await cf(base+item.name+'/versions/'+item.after);
 if(v?.id!==item.after)throw Error('Staged candidate missing '+item.name);
}
console.log('PREFLIGHT_OK');
let changed=[];
try{
 for(const item of releases){await activate(item.name,item.after,'RelayWA platform admin session statistics');changed.push(item);console.log('ACTIVATED',item.name,item.after);}
 const health=await fetch('https://relaywa.com/api/health',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const h=await health.json().catch(()=>null);
 if(health.status!==200||h?.status!=='ok'||h?.db!=='up')throw Error('API health failed');
 const forbidden=await fetch('https://platform.relaywa.com/api/platform/sessions/00000000-0000-0000-0000-000000000000/statistics',{redirect:'manual',signal:AbortSignal.timeout(15000)});
 console.log('AUTH_PROBE',forbidden.status);
 if(![401,403].includes(forbidden.status))throw Error('Platform stats auth bypass or incorrect route '+forbidden.status);
 const page=await fetch('https://platform.relaywa.com/platform',{redirect:'manual',signal:AbortSignal.timeout(15000)});
 console.log('PLATFORM_HTTP',page.status);
 if(page.status!==200)throw Error('Platform dashboard unavailable '+page.status);
 console.log('PLATFORM_SESSION_STATISTICS_LIVE');
}catch(e){
 console.error('RELEASE_FAILED',String(e.message).slice(0,200));
 for(const item of changed.reverse())try{await activate(item.name,item.before,'Rollback platform session statistics');console.log('ROLLED_BACK',item.name)}catch(err){console.error('MANUAL_ROLLBACK_REQUIRED',item.name,String(err.message).slice(0,130))}
 throw e;
}
