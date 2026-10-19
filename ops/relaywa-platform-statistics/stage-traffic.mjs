import {patchPlatformPage} from './patch-web.mjs';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-web';
const headers={authorization:'Bearer '+token};
async function request(url,options={}){
 const r=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(e=>e.code)));
 return j.result;
}
async function active(){
 const d=await request(root+'/deployments');const v=d.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split');
 return v[0].version_id;
}
const before='d99bd498-677b-48ed-93c6-687019dfe439';
if(await active()!==before)throw Error('Live web Worker changed; abort');
const res=await fetch(root,{headers,signal:AbortSignal.timeout(45000)});
if(!res.ok)throw Error('Cannot retrieve current Worker');
const modules=await res.formData(), settings=await request(root+'/settings');
const upload=new FormData();upload.append('metadata',JSON.stringify({
 main_module:'index.js',bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
 keep_assets:true,...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
 ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
 annotations:{'workers/message':'Fix RelayWA platform sessions statistics in active traffic asset'}
}));
let changed=[];
for(const [name,value] of modules.entries()){
 let source=typeof value==='string'?value:await value.text();
 let result=source;
 if(name==='recovery-assets.mjs'){
  if(!source.startsWith('export default '))throw Error('Wrong recovery asset encoding');
  const assets=JSON.parse(source.slice('export default '.length).trim().replace(/;$/,''));
  const key='/_next/static/chunks/page-traffic-20261013-v1.js';
  if(typeof assets[key]!=='string'||!assets[key].includes('All linked sessions'))throw Error('Active traffic chunk missing');
  if(assets[key].includes('RELAYWA_PLATFORM_STATS_UI_V1'))throw Error('Already patched active asset');
  assets[key]=patchPlatformPage(assets[key]);
  result='export default '+JSON.stringify(assets)+';\n';
 }
 if(name==='index.js'){
  const anchor='if(recoveryAssets[path]) return new Response(recoveryAssets[path],{headers:';
  if(source.split(anchor).length!==2)throw Error('Unexpected live static gateway');
  result=source.replace(anchor,'if(recoveryAssets[path]) return new Response(recoveryAssets[path],{headers:');
  const cache='"cache-control":path.endsWith(".css")?"no-cache":"public, max-age=31536000, immutable"';
  if(result.split(cache).length!==2)throw Error('Unexpected gateway cache header');
  result=result.replace(cache,'"cache-control":path==="/_next/static/chunks/page-traffic-20261013-v1.js"?"no-store":path.endsWith(".css")?"no-cache":"public, max-age=31536000, immutable"');
 }
 if(result!==source){
   const file='/tmp/relaywa-traffic-candidate.mjs';writeFileSync(file,result);
   const t=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
   if(t.status!==0)throw Error('Syntax invalid '+name+': '+String(t.stderr).slice(-250));
   changed.push(name);
 }
 upload.append(name,new Blob([result],{type:'application/javascript+module'}),name);
}
if(changed.length!==2||!changed.includes('recovery-assets.mjs')||!changed.includes('index.js'))throw Error('Expected exact two Worker modules');
const staged=await request(root+'/versions?bindings_inherit=strict',{method:'POST',body:upload});
if(await active()!==before)throw Error('Unexpected production change');
console.log('ACTIVE_TRAFFIC_ASSET_STAGED',staged.id??staged.version?.id,'PREVIOUS',before,'MODULES',changed.join(','));
