import {patchPlatform} from './patch-platform.mjs';
import {patchPlatformPage,patchRecoveryAssets} from './patch-web.mjs';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Cloudflare credentials unavailable');
const root='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/';
const headers={authorization:'Bearer '+token};
async function cf(url,options={}){
 const res=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});
 const body=await res.json();
 if(!res.ok||!body.success)throw Error('Cloudflare '+res.status+' '+JSON.stringify(body.errors?.map(x=>({code:x.code,message:String(x.message).slice(0,280)}))));
 return body.result;
}
const targets=[
 {name:'relaywa-platform',expected:'3eb22452-a378-4e77-a201-53f3b62e939d',patches:{'index.js':patchPlatform}},
 {name:'relaywa-web',expected:'e8de7e2a-b4c8-4749-8102-34fac1b438a5',patches:{'ssr/_next/static/page-Gh6edkTR.js':patchPlatformPage,'recovery-assets.mjs':patchRecoveryAssets}}
];
async function active(name){const d=await cf(root+name+'/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Split traffic '+name);return v[0].version_id;}
for(const target of targets){
 if(await active(target.name)!==target.expected)throw Error('Production '+target.name+' version drift');
 const settings=await cf(root+target.name+'/settings');
 const current=await fetch(root+target.name,{headers,signal:AbortSignal.timeout(60000)});
 if(!current.ok)throw Error('Worker download failed '+target.name);
 const modules=await current.formData();
 const upload=new FormData();
 upload.append('metadata',JSON.stringify({
  main_module:'index.js',
  bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
  ...(target.name==='relaywa-web'?{keep_assets:true}:{}),
  ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
  ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
  annotations:{'workers/message':'RelayWA platform session statistics inactive staging'}
 }));
 let patched=0;
 for(const [name,value] of modules.entries()){
  const before=typeof value==='string'?value:await value.text();
  const fn=target.patches[name];
  const after=fn?fn(before):before;
  if(fn){patched++;
   writeFileSync('/tmp/relaywa-statistics-validation.mjs',after);
   const test=spawnSync(process.execPath,['--check','/tmp/relaywa-statistics-validation.mjs'],{encoding:'utf8'});
   if(test.status!==0)throw Error('Syntax validation failed '+target.name+'/'+name+': '+String(test.stderr).slice(-350));
  }
  upload.append(name,new Blob([after],{type:'application/javascript+module'}),name);
 }
 if(patched!==Object.keys(target.patches).length)throw Error('Missing required live modules '+target.name);
 const staged=await cf(root+target.name+'/versions?bindings_inherit=strict',{method:'POST',body:upload});
 if(await active(target.name)!==target.expected)throw Error('Unexpected production activation '+target.name);
 console.log('STAGED',target.name,'PREVIOUS',target.expected,'CANDIDATE',staged.id??staged.version?.id);
}
console.log('PLATFORM_STATISTICS_STAGED_NOT_LIVE');
