// Guarded publication of RelayWA responsive Sessions UI.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,opt={}){
 const response=await fetch(root+path,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok||!data.success)throw Error('Cloudflare '+response.status+' '+JSON.stringify(data.errors?.map(e=>e.code)));
 return data.result;
}
async function active(){
 const d=await cf('/deployments'),versions=d.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].percentage!==100)throw Error('Unexpected production traffic split');
 return versions[0].version_id;
}
async function deploy(version,message){
 await cf('/deployments',{method:'POST',body:JSON.stringify({
  strategy:'percentage',versions:[{version_id:version,percentage:100}],
  annotations:{'workers/message':message}
 })});
 if(await active()!==version)throw Error('Activation mismatch');
}
const previous='4f84250b-a1c4-4e7a-a463-b78fcdfe0ef1';
const candidate='53b807db-727f-4cb8-b00a-99fb27988a23';
if(await active()!==previous)throw Error('Production changed since staging; abort');
if((await cf('/versions/'+candidate)).id!==candidate)throw Error('Staged version not found');
let changed=false;
try{
 await deploy(candidate,'RelayWA responsive Platform Admin Sessions mobile layout');changed=true;
 let passed=false;
 for(let attempt=1;attempt<=12;attempt++){
  const html=await fetch('https://platform.relaywa.com/platform?mobileRelease='+Date.now(),{
   headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const page=await html.text();
  const ui=await fetch('https://platform.relaywa.com/relaywa-platform-stats-20261020.js?mobileRelease='+Date.now(),{
   headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const source=await ui.text();
  const login=await fetch('https://platform.relaywa.com/relaywa-admin-renew-v1.js?mobileRelease='+Date.now(),{
   headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const ok=html.status===200&&ui.status===200&&login.status===200&&
   page.includes('relaywa-platform-stats-20261020.js')&&page.includes('relaywa-admin-renew-v1.js')&&
   source.includes('rw3-session-card')&&source.includes('rw3-sessions-table')&&
   source.includes('decorateSessionRows')&&source.includes('max-width: 800px')&&
   source.includes('max-width: 390px')&&source.includes('data-relaywa-stats');
  console.log('MOBILE_UI_EDGE_CHECK',attempt,html.status,ui.status,login.status,ok);
  if(ok){passed=true;break;}
  await new Promise(r=>setTimeout(r,5000));
 }
 if(!passed)throw Error('Mobile Sessions stylesheet failed live edge verification');
 const unauth=await fetch('https://platform.relaywa.com/api/platform/whoami',{
  signal:AbortSignal.timeout(15000)});
 if(unauth.status!==401)throw Error('Platform authentication unexpectedly exposed: '+unauth.status);
 console.log('RELAYWA_MOBILE_SESSIONS_PRODUCTION_LIVE',candidate);
}catch(error){
 console.error('RELEASE_FAILED',String(error.message).slice(0,250));
 if(changed){
  try{await deploy(previous,'Automatic rollback RelayWA mobile Sessions UI');console.log('AUTO_ROLLBACK_COMPLETE');}
  catch(rollback){console.error('MANUAL_ROLLBACK_REQUIRED',String(rollback.message).slice(0,170));}
 }
 throw error;
}
