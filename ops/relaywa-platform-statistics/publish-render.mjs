const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare credentials missing');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-web';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,opt={}){const r=await fetch(root+path,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||!d.success)throw Error('Cloudflare request '+r.status+' '+JSON.stringify(d.errors?.map(x=>x.code)));return d.result;}
async function live(){const d=await cf('/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Traffic split');return v[0].version_id;}
async function set(v,msg){await cf('/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:v,percentage:100}],annotations:{'workers/message':msg}})});if(await live()!==v)throw Error('Not active '+v);}
const before='5568b15b-9f76-4e3e-beb6-4996126f2371',after='2d45e671-bda3-44c9-abc0-cba8053cff00';
if(await live()!==before)throw Error('Current live Worker changed');
if((await cf('/versions/'+after)).id!==after)throw Error('Candidate missing');
let changed=false;
try{
 await set(after,'RelayWA platform session statistics rendered button fix');changed=true;
 const html=await fetch('https://platform.relaywa.com/platform?check='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const body=await html.text();
 if(html.status!==200||!body.includes('/relaywa-stats-runtime-20261020.js'))throw Error('Injected script not in platform HTML');
 const js=await fetch('https://platform.relaywa.com/relaywa-stats-runtime-20261020.js',{signal:AbortSignal.timeout(15000)});
 const source=await js.text();
 if(js.status!==200||!source.includes('data-relaywa-stats')||!source.includes('Message statistics'))throw Error('Runtime JS not served correctly');
 console.log('RELAYWA_STATS_RENDER_SCRIPT_LIVE',after,'HTML',html.status,'JS',js.status);
}catch(e){console.error('DEPLOY_FAILED',String(e.message));if(changed)await set(before,'Rollback RelayWA session stats render fix').catch(x=>console.error('MANUAL_ROLLBACK',String(x.message)));throw e;}
