const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;if(!account||!token)throw Error('Missing credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform',headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,opt={}){const r=await fetch(root+path,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(35000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(e=>e.code)));return j.result}
async function live(){const d=await cf('/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Traffic split');return v[0].version_id}
async function deploy(version,message){await cf('/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':message}})});if(await live()!==version)throw Error('Deployment mismatch')}
const old='0d3b9a31-06fc-4d54-9052-19e94c732bb0',next='e41e6786-2795-428c-b261-541f3c659f20';
if(await live()!==old)throw Error('Live version drift');
if((await cf('/versions/'+next)).id!==next)throw Error('Candidate absent');
let activated=false;
try{
 await deploy(next,'Fix RelayWA platform Sessions Statistics button in true platform proxy');activated=true;
 const html=await fetch('https://platform.relaywa.com/platform?verify='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
 const text=await html.text();console.log('PLATFORM_HTML',html.status,html.headers.get('cache-control'),'SCRIPT_PRESENT',text.includes('relaywa-platform-stats-20261020.js'));
 if(html.status!==200||!text.includes('relaywa-platform-stats-20261020.js'))throw Error('New platform HTML missing loader');
 const js=await fetch('https://platform.relaywa.com/relaywa-platform-stats-20261020.js',{signal:AbortSignal.timeout(15000)});
 const body=await js.text();console.log('LOADER',js.status,body.length,body.includes('data-relaywa-stats'));
 if(js.status!==200||!body.includes('data-relaywa-stats'))throw Error('Runtime loader unavailable');
 console.log('PLATFORM_STATISTICS_PROXY_LIVE',next);
}catch(error){console.error('RELEASE_ERROR',String(error.message));if(activated)await deploy(old,'Automatic rollback platform statistics').catch(e=>console.error('MANUAL_ROLLBACK_REQUIRED',String(e.message)));throw error}
