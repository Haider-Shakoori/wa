const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,candidate=process.env.RELAYWA_TRAFFIC_CANDIDATE;
if(!account||!token||!candidate)throw Error('Missing release configuration');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-web',headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(url,opts={}){const r=await fetch(url,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(35000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(x=>x.code)));return j.result}
async function live(){const d=await cf(root+'/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Traffic split');return v[0].version_id}
async function set(id,message){await cf(root+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':message}})});if(await live()!==id)throw Error('Activation mismatch')}
const previous='d99bd498-677b-48ed-93c6-687019dfe439';
if(await live()!==previous)throw Error('Live version drift');
const version=await cf(root+'/versions/'+candidate);if(version?.id!==candidate)throw Error('Candidate missing');
let switched=false;
try{
 await set(candidate,'RelayWA platform admin actual traffic chunk statistics fix');switched=true;
 const url='https://platform.relaywa.com/_next/static/chunks/page-traffic-20261013-v1.js';
 const res=await fetch(url+'?releaseCheck='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const js=await res.text();
 console.log('ACTIVE_TRAFFIC_ASSET_CHECK',res.status,js.includes('RELAYWA_PLATFORM_STATS_UI_V1'),js.includes('rwPlatformStatistics'));
 if(res.status!==200||!js.includes('RELAYWA_PLATFORM_STATS_UI_V1')||!js.includes('rwPlatformStatistics'))throw Error('Public traffic asset does not contain statistics');
 const home=await fetch('https://platform.relaywa.com/platform',{signal:AbortSignal.timeout(15000)});
 if(home.status!==200)throw Error('Platform page HTTP '+home.status);
 console.log('RELAYWA_PLATFORM_ADMIN_STATISTICS_VERIFIED_LIVE',candidate);
}catch(e){console.error('VERIFICATION_FAILED',String(e.message));if(switched)await set(previous,'Rollback incomplete platform admin traffic chunk').catch(e=>console.error('MANUAL_ROLLBACK',String(e.message)));throw e}
