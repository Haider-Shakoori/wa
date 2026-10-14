import {patchPlatform,patchApi} from './patch.mjs';
import {patchWebsitePage} from './patch-web.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare account token unavailable');
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={authorization:'Bearer '+token};
const manifest=[
  ['relaywa-platform',new Map([['index.js',patchPlatform]])],
  ['relaywa-api',new Map([['index.js',patchApi]])],
  ['relaywa-web',new Map([
    ['ssr/_next/static/page-Gh6edkTR.js',patchWebsitePage],
    ['recovery-assets.mjs',patchWebsitePage],
  ])],
];
async function apiJson(url,options={}){
  const res=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(35000)});
  const data=await res.json();
  if(!res.ok||!data.success)throw Error('Cloudflare API error '+res.status+': '+JSON.stringify(data.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,130)}))));
  return data.result;
}
for(const [script,patchers] of manifest){
  const settings=await apiJson(base+'/workers/scripts/'+script+'/settings');
  const history=await apiJson(base+'/workers/scripts/'+script+'/deployments');
  const deployed=history.deployments?.[0]?.versions?.find(v=>v.percentage===100)?.version_id;
  if(!deployed)throw Error('Could not determine current deployed version '+script);
  const old=await fetch(base+'/workers/scripts/'+script,{headers,signal:AbortSignal.timeout(35000)});
  if(!old.ok)throw Error('Failed to retrieve deployed Worker '+script);
  const modules=await old.formData();
  const form=new FormData();
  const metadata={
    main_module:'index.js',
    bindings:settings.bindings.map(b=>({type:'inherit',name:b.name})),
    ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
    ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
    annotations:{'workers/message':'RelayWA website plan edit, disable and safe delete - staged, not deployed'},
  };
  form.append('metadata',JSON.stringify(metadata));
  let count=0;
  for(const [name,value] of modules.entries()){
    const original=typeof value==='string'?value:await value.text();
    const patcher=patchers.get(name);
    const patched=patcher?patcher(original):original;
    if(patcher){if(patched===original)throw Error('No patch applied to '+script+'/'+name);count++;}
    form.append(name,new Blob([patched],{type:'application/javascript+module'}),name);
  }
  if(count!==patchers.size)throw Error('Missing expected Worker modules for '+script);
  const staged=await apiJson(base+'/workers/scripts/'+script+'/versions?bindings_inherit=strict',{
    method:'POST',body:form,headers:{},
  });
  const id=staged.id??staged.version?.id;
  if(!id)throw Error('Worker version upload returned no ID: '+script);
  const now=await apiJson(base+'/workers/scripts/'+script+'/deployments');
  const still=now.deployments?.[0]?.versions?.find(v=>v.percentage===100)?.version_id;
  if(still!==deployed)throw Error('Deployed Worker changed unexpectedly after staging '+script);
  console.log('STAGED_WORKER '+script+' old='+deployed+' candidate='+id+' modules='+Array.from(modules.keys()).length+' patched='+count);
}
console.log('STAGING_COMPLETE_NOT_DEPLOYED');
