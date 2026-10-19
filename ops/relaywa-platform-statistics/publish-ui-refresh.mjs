const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,opt={}){const r=await fetch(root+path,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(e=>e.code)));return j.result;}
async function active(){const d=await cf('/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split');return v[0].version_id;}
async function set(id,message){await cf('/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':message}})});if(await active()!==id)throw Error('Activation mismatch');}
const prior='e41e6786-2795-428c-b261-541f3c659f20',candidate='d3c86ec8-9223-475b-be51-90d158e86410';
if(await active()!==prior)throw Error('Active Worker changed unexpectedly');
if((await cf('/versions/'+candidate)).id!==candidate)throw Error('Inactive release version not found');
let changed=false;
try{
 await set(candidate,'RelayWA Sessions table and Statistics modal visual refresh');changed=true;
 let verified=false;
 for(let i=0;i<10;i++){
  const html=await fetch('https://platform.relaywa.com/platform?ui='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  const page=await html.text();
  const js=await fetch('https://platform.relaywa.com/relaywa-platform-stats-20261020.js?ui='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  const text=await js.text();
  const good=html.status===200&&page.includes('relaywa-platform-stats-20261020.js')&&js.status===200&&text.includes('rw2-modal')&&text.includes('rw2-cards')&&text.includes('data-relaywa-stats');
  console.log('VERIFY_ATTEMPT',i+1,'HTML',html.status,'JS',js.status,'ENHANCED',good);
  if(good){verified=true;break;}
  await new Promise(r=>setTimeout(r,4000));
 }
 if(!verified)throw Error('Enhanced platform frontend not visible at production edge');
 console.log('RELAYWA_ENHANCED_SESSIONS_LIVE',candidate);
}catch(e){console.error('RELEASE_FAILED',String(e.message));if(changed)await set(prior,'Rollback RelayWA session UI refresh').catch(x=>console.error('MANUAL_ROLLBACK_REQUIRED',String(x.message)));throw e;}
