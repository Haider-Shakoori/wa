import {readFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-web';
const hdr={authorization:'Bearer '+token};
async function cf(url,options={}) {const r=await fetch(url,{...options,headers:{...hdr,...options.headers},signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,160)}))));return j.result;}
async function active(){const x=await cf(base+'/deployments');const v=x.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Traffic split');return v[0].version_id;}
const prior='5568b15b-9f76-4e3e-beb6-4996126f2371';
if(await active()!==prior)throw Error('Production Worker version changed');
const r=await fetch(base,{headers:hdr,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Worker download failed');
const modules=await r.formData(),settings=await cf(base+'/settings');
const form=new FormData();
form.append('metadata',JSON.stringify({main_module:'index.js',bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),keep_assets:true,...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{})}));
const js=readFileSync('ops/relaywa-platform-statistics/runtime-mount.js','utf8');
let changed=0;
for(const [name,value] of modules.entries()){
 let data=typeof value==='string'?value:await value.text();
 if(name==='index.js'){
  if(data.includes('relaywa-stats-runtime-20261020.js'))throw Error('Already patched');
  const needle='if(recoveryAssets[path]) return new Response(recoveryAssets[path],{headers:';
  if(data.split(needle).length!==2)throw Error('Asset gateway mismatch');
  data=data.replace(needle,"if(path==='/relaywa-stats-runtime-20261020.js')return new Response(statsMountScript,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'}});\n "+needle);
  const entry='const __relaywaPlatformGateway=';
  if(data.split(entry).length!==2)throw Error('Gateway marker mismatch');
  data="import {statsMountScript} from './relaywa-stats-mount.mjs';\n"+data;
  const head="element.append('<style data-relaywa-persistent-styles";
  if(data.split(head).length!==2)throw Error('HTMLRewriter marker mismatch');
  data=data.replace(head,"if(host==='platform.relaywa.com'&&path==='/platform')element.append('<script src=\\\"/relaywa-stats-runtime-20261020.js\\\" defer></script>',{html:true});\n "+head);
  changed++;
 }
 form.append(name,new Blob([data],{type:'application/javascript+module'}),name);
}
if(changed!==1)throw Error('Missing main module');
form.append('relaywa-stats-mount.mjs',new Blob(['export const statsMountScript='+JSON.stringify(js)+';'],{type:'application/javascript+module'}),'relaywa-stats-mount.mjs');
const result=await cf(base+'/versions?bindings_inherit=strict',{method:'POST',body:form});
if(await active()!==prior)throw Error('Production changed during stage');
console.log('STATS_RUNTIME_STAGED',result.id??result.version?.id,'PRIOR',prior);
