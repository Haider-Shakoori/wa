// Guarded one-time activation of an already validated/inactive Cloudflare API Worker version.
// Preserve binding state; no D1 schema or customer data changes.
const activeBefore='122829c2-db1d-49e1-8038-f3bc355b2031';
const candidate='492d3e3f-33e5-4c1b-921c-6b0e8a446e28';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token||process.env.RELAYWA_HEARTBEAT_DEPLOY_CONFIRM!=='APPLY_RELAYWA_HEARTBEAT_FUSION_20261015')
  throw Error('Release credentials or confirmation missing');
if(process.env.GITHUB_REF!=='refs/heads/perf/relaywa-request-efficiency')
  throw Error('Release branch mismatch');
const api='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-api';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,options={}){
  const res=await fetch(api+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(25000)});
  const data=await res.json();
  if(!res.ok||!data.success)throw Error('Cloudflare HTTP '+res.status+' '+JSON.stringify(data.errors?.map(x=>x.code)));
  return data.result;
}
async function deployed(){
  const deployments=await cf('/deployments');
  const versions=deployments.deployments?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||versions[0].percentage!==100)
    throw Error('Unexpected Worker traffic split');
  return versions[0].version_id;
}
async function activate(version,message){
  const result=await cf('/deployments',{method:'POST',body:JSON.stringify({
    strategy:'percentage',versions:[{version_id:version,percentage:100}],
    annotations:{'workers/message':message}
  })});
  if(!result.id||await deployed()!==version)throw Error('Cloudflare activation not confirmed');
}
if(await deployed()!==activeBefore)throw Error('Original Worker version changed: no deployment');
const newer=await cf('/versions/'+candidate);
if(!newer?.id||newer.id!==candidate)throw Error('Staged version does not exist');
console.log('RELAYWA_API_DEPLOY_PREFLIGHT_PASS');
// Applying only existing API Worker script. Any error after activation rolls back.
let activated=false;
try {
  await activate(candidate,'RelayWA worker command heartbeat request reduction');
  activated=true;
  const url='https://relaywa.com/api/health';
  const response=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  const body=await response.json();
  if(response.status!==200||body.status!=='ok'||body.db!=='up')
    throw Error('Health response failed');
  const protectedRequest=await fetch('https://api.relaywa.com/internal/worker/commands/claim',{
    method:'POST',headers:{'content-type':'application/json'},
    body:'{}',signal:AbortSignal.timeout(10000)});
  console.log('UNAUTHORIZED_WORKER_ROUTE_HTTP '+protectedRequest.status);
  if(![401,403].includes(protectedRequest.status))
    throw Error('Auth guard on worker command route failed');
  console.log('RELAYWA_API_HEARTBEAT_FUSION_ACTIVE '+candidate);
}catch(error){
  console.error('HEARTBEAT_FUSION_RELEASE_FAILED '+String(error.message).slice(0,260));
  if(activated){
    await activate(activeBefore,'Rollback RelayWA heartbeat fusion').catch(err=>console.error('MANUAL_ROLLBACK_NEEDED '+String(err.message).slice(0,200)));
  }
  throw error;
}
