import { applyCommandHeartbeatPatch } from './patch-api.mjs';

/** Upload an INACTIVE, bound-to-current-version RelayWA API build to Cloudflare. */
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare deployment credentials missing');
const api='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={authorization:'Bearer '+token};

async function json(url,init={}){
  const r=await fetch(url,{...init,headers:{...headers,...init.headers},signal:AbortSignal.timeout(30000)});
  const v=await r.json();
  if(!r.ok||!v.success)throw Error('Cloudflare endpoint returned HTTP '+r.status+' '+JSON.stringify(v.errors?.map(x=>({code:x.code,message:String(x.message||'').slice(0,350)}))));
  return v.result;
}
async function activeVersion() {
  const data=await json(api+'/workers/scripts/relaywa-api/deployments');
  const versions=data.deployments?.[0]?.versions;
  if(!Array.isArray(versions)||versions.length!==1||versions[0].percentage!==100)
    throw Error('Unexpected relaywa-api deployment/traffic split');
  return versions[0].version_id;
}
const active=await activeVersion();
const settings=await json(api+'/workers/scripts/relaywa-api/settings');
if(!Array.isArray(settings.bindings)||!settings.bindings.some(x=>x.name==='DB'&&x.type==='d1'))
  throw Error('Live D1 binding not found');
const original=await fetch(api+'/workers/scripts/relaywa-api',{headers,signal:AbortSignal.timeout(30000)});
if(!original.ok)throw Error('Cannot retrieve currently deployed Worker');
const modules=await original.formData();
// Diagnostic module inventory contains only filenames and MIME types, never code or secrets.
if(!modules.has('index.js'))throw Error('Cloudflare index.js is missing');
console.log('CLOUDFLARE_BUNDLE_MODULE_TYPES '+JSON.stringify(Array.from(modules.entries()).map(([name,value])=>({name,filename:typeof value==='string'?'':value.name,mime:typeof value==='string'?'string':value.type,size:typeof value==='string'?value.length:value.size}))));
const input=modules.get('index.js');
const code=typeof input==='string'?input:await input.text();
const updated=applyCommandHeartbeatPatch(code);
if(updated.length-code.length>1600)throw Error('Unexpectedly large Worker modification');
const form=new FormData();
form.append('metadata',JSON.stringify({
  main_module:'index.js',
  bindings:settings.bindings.map(x=>({type:'inherit',name:x.name})),
  ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
  ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
  annotations:{'workers/message':'RelayWA idempotent command-claim worker heartbeat fusion (inactive stage)'}
}));
for(const [name,value] of modules.entries()){
  if(name==='index.js')form.append(name,new Blob([updated],{type:'application/javascript+module'}),name);
  else if(typeof value==='string')form.append(name,value);
  else form.append(name,value,name);
}
if(await activeVersion()!==active)throw Error('Live API changed before staging');
const staged=await json(api+'/workers/scripts/relaywa-api/versions?bindings_inherit=strict',{method:'POST',body:form});
const stagedId=staged.id??staged.version?.id;
if(!stagedId)throw Error('Cloudflare did not return the staged version ID');
if(await activeVersion()!==active)throw Error('Live API changed during inactive stage; deployment is not approved');
console.log('RELAYWA_HEARTBEAT_STAGE_SUCCESS active='+active+' inactive='+stagedId+' modules='+Array.from(modules.keys()).length);
