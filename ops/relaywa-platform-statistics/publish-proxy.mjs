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
 let verified=false;
 for(let attempt=1;attempt<=12;attempt++){
  const html=await fetch('https://platform.relaywa.com/platform?verify='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const text=await html.text();
  const js=await fetch('https://platform.relaywa.com/relaywa-platform-stats-20261020.js?verify='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const body=await js.text();
  console.log('EDGE_ATTEMPT',attempt,'HTML',html.status,'SCRIPT',text.includes('relaywa-platform-stats-20261020.js'),'JS',js.status,'MARKER',body.includes('data-relaywa-stats'));
  if(html.status===200&&text.includes('relaywa-platform-stats-20261020.js')&&js.status===200&&body.includes('data-relaywa-stats')){verified=true;break;}
  await new Promise(r=>setTimeout(r,5000));
 }
 if(!verified)throw Error('Platform HTML and loader did not propagate within 60 seconds');
 console.log('PLATFORM_STATISTICS_PROXY_LIVE',next);
}catch(error){console.error('RELEASE_ERROR',String(error.message));if(activated)await deploy(old,'Automatic rollback platform statistics').catch(e=>console.error('MANUAL_ROLLBACK_REQUIRED',String(e.message)));throw error}
