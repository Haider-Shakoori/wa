import {patchPlatform} from './patch-platform.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare credentials missing');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token};
async function cf(path,options={}){
 const response=await fetch(root+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});
 const body=await response.json();
 if(!response.ok||!body.success)throw Error('Cloudflare '+response.status+': '+JSON.stringify(body.errors?.map(x=>({code:x.code,message:String(x.message).slice(0,220)}))));
 return body.result;
}
async function active(){
 const deployment=await cf('/deployments');
 const versions=deployment.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].percentage!==100)throw Error('Unexpected traffic split');
 return versions[0].version_id;
}
const expected='d3c86ec8-9223-475b-be51-90d158e86410';
if(await active()!==expected)throw Error('Unexpected production Worker version; abort staging');
const live=await fetch(root,{headers,signal:AbortSignal.timeout(60000)});
if(!live.ok)throw Error('Cannot retrieve current Worker');
const modules=await live.formData(),settings=await cf('/settings');
if(modules.has('relaywa-admin-renew-v1.mjs'))throw Error('Renewal module already exists');
const script=readFileSync('ops/relaywa-auth-renewal/browser-renewal.js','utf8');
const check=spawnSync(process.execPath,['--check','ops/relaywa-auth-renewal/browser-renewal.js'],{encoding:'utf8'});
if(check.status!==0)throw Error('Browser syntax check failed: '+String(check.stderr).slice(-300));
const form=new FormData();
form.append('metadata',JSON.stringify({
 main_module:'index.js',
 bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
 ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
 ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
 annotations:{'workers/message':'RelayWA secure platform admin session renewal - inactive candidate'}
}));
let patched=0;
for(const [name,value] of modules.entries()){
 let source=typeof value==='string'?value:await value.text();
 if(name==='index.js'){
   source=patchPlatform(source);
   const statMarker="el.append('<script src=\"/relaywa-platform-stats-20261020.js\" defer></script>',{html:true});";
   if(source.split(statMarker).length!==2)throw Error('Existing Statistics UI HTML injection missing');
   source=source.replace(statMarker,
     "el.append('<script src=\"/relaywa-admin-renew-v1.js\" defer></script>',{html:true});"+statMarker);
   const route='if(p==="/relaywa-platform-stats-20261020.js")';
   if(source.split(route).length!==2)throw Error('Existing versioned gateway route missing');
   source=source.replace(route,
     'if(p==="/relaywa-admin-renew-v1.js")return new Response(rwAdminBrowserRenewal,{headers:{"content-type":"application/javascript; charset=utf-8","cache-control":"no-store"}});\n      '+route);
   source="import {rwAdminBrowserRenewal} from './relaywa-admin-renew-v1.mjs';\n"+source;
   writeFileSync('/tmp/relaywa-session-renew-worker.mjs',source);
   const validation=spawnSync(process.execPath,['--check','/tmp/relaywa-session-renew-worker.mjs'],{encoding:'utf8'});
   if(validation.status!==0)throw Error('Worker syntax failed: '+String(validation.stderr).slice(-450));
   for(const tag of ['RELAYWA_SECURE_SESSION_RENEWAL_V1','/api/auth/refresh','/api/auth/logout'])
     if(!source.includes(tag))throw Error('Missing security marker '+tag);
   patched++;
 }
 form.append(name,new Blob([source],{type:'application/javascript+module'}),name);
}
if(patched!==1)throw Error('Main platform Worker module was not patched');
form.append('relaywa-admin-renew-v1.mjs',
 new Blob(['export const rwAdminBrowserRenewal='+JSON.stringify(script)+';\n'],{type:'application/javascript+module'}),'relaywa-admin-renew-v1.mjs');
const staged=await cf('/versions?bindings_inherit=strict',{method:'POST',body:form});
if(await active()!==expected)throw Error('Production changed during staging');
console.log('PLATFORM_SESSION_RENEWAL_STAGED',staged.id??staged.version?.id,'PREVIOUS',expected);
