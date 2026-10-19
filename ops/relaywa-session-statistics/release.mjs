import {patchWeb} from './patch-web.mjs';
import { patchApi } from './patch.mjs';
const id=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/relaywa-api';
const headers={Authorization:'Bearer '+token};
async function cf(path,options={}){
 const response=await fetch(root+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
 const result=await response.json();
 if(!response.ok||!result.success)throw Error('Cloudflare API '+response.status+' '+JSON.stringify(result.errors?.map(x=>x.code)));
 return result.result;
}
async function active(){
 const deployments=await cf('/deployments');
 const versions=deployments.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].percentage!==100)throw Error('Unexpected traffic split');
 return versions[0].version_id;
}
const old=await active();
const settings=await cf('/settings');
const source=await fetch(root,{headers,signal:AbortSignal.timeout(30000)});
if(!source.ok)throw Error('Cannot retrieve current API modules');
const modules=await source.formData();
const original=modules.get('index.js');
if(!original)throw Error('Missing deployed API main module');
const content=typeof original==='string'?original:await original.text();
if(process.env.RELEASE_PHASE==='stage'){
 const updated=content.includes('RELAYWA_SESSION_STATISTICS_V1')?null:patchApi(content); const upload=new FormData();
 upload.append('metadata',JSON.stringify({
   main_module:'index.js',
   bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
   ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
   ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
   annotations:{'workers/message':'RelayWA session statistics staged inactive'}
 }));
 for(const [name,value] of modules.entries()){
   const body=name==='index.js'?(updated??content):typeof value==='string'?value:await value.text();
   upload.append(name,new Blob([body],{type:'application/javascript+module'}),name);
 }
 const staged=updated?await cf('/versions?bindings_inherit=strict',{method:'POST',body:upload}):{id:'already-staged'};
 if(await active()!==old)throw Error('Production changed during stage');
 console.log('STAGED_API_VERSION',staged.id??staged.version?.id,'PREVIOUS',old);
 const webUrl='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/relaywa-web';
 const web=await fetch(webUrl,{headers,signal:AbortSignal.timeout(30000)});
 if(!web.ok)throw Error('Could not inspect deployed web worker');
 const webModules=await web.formData();
 for(const [name,value] of webModules.entries()){
   const text=typeof value==='string'?value:await value.text();
   const probes=['One number. One isolated session','Manage session','Last connected','rw-session-grid','Your workspace','Connected numbers','Message activity','rw-session-card-actions'];
   const hits=probes.filter(p=>text.includes(p));
   if(hits.length)console.log('WEB_BUNDLE_CANDIDATE',name,'BYTES',text.length,'MATCHES',hits.join('|'));
   if(name==='ssr/_next/static/relay-workspace-ChKJxgxv.js'){
     for(const marker of ['rw-session-card-actions','rw-session-info','Session information','rw-modal-head']){
       const at=text.indexOf(marker); if(at>=0)console.log('WEB_SAMPLE',marker,JSON.stringify(text.slice(Math.max(0,at-270),at+600)));
     }
   }
 }
 console.log('WEB_MODULE_COUNT',Array.from(webModules.keys()).length);
 const settingsWebResponse=await fetch(webUrl+'/settings',{headers,signal:AbortSignal.timeout(30000)});
 const settingsWebBody=await settingsWebResponse.json();
 if(!settingsWebResponse.ok||!settingsWebBody.success)throw Error('Cannot retrieve Web Worker settings');
 const settingsWeb=settingsWebBody.result;
 const deploymentsResponse=await fetch(webUrl+'/deployments',{headers,signal:AbortSignal.timeout(30000)});
 const deploymentsBody=await deploymentsResponse.json();
 if(!deploymentsResponse.ok||!deploymentsBody.success)throw Error('Cannot retrieve Web Worker active deployment');
 const webActive=deploymentsBody.result.deployments?.[0]?.versions;
 if(webActive?.length!==1||webActive[0].percentage!==100)throw Error('Web Worker traffic is split');
 const originalWeb=webActive[0].version_id;
 const required=['ssr/_next/static/relay-workspace-ChKJxgxv.js','recovery-assets.mjs'];
 const webAlready=required.every(key=>{const value=webModules.get(key);return Boolean(value)});
 if(!webAlready)throw Error('Live Web Worker missing required session assets');
 const uploadWeb=new FormData();
 uploadWeb.append('metadata',JSON.stringify({
   main_module:'index.js',
   bindings:settingsWeb.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
   keep_assets:true,
   ...(settingsWeb.compatibility_date?{compatibility_date:settingsWeb.compatibility_date}:{}),
   ...(settingsWeb.compatibility_flags?{compatibility_flags:settingsWeb.compatibility_flags}:{}),
   annotations:{'workers/message':'RelayWA session statistics UI staged inactive'}
 }));
 let changed=0;
 for(const [name,value] of webModules.entries()){
   const sourceText=typeof value==='string'?value:await value.text();
   const after=required.includes(name)?(sourceText.includes('RELAYWA_STATS_UI_V1')?sourceText:patchWeb(sourceText)):sourceText;
   if(after!==sourceText)changed++;
   uploadWeb.append(name,new Blob([after],{type:'application/javascript+module'}),name);
 }
 if(changed===0){console.log('WEB_UI_ALREADY_STAGED');}
 else{
  if(changed!==required.length)throw Error('Did not patch all required customer modules');
  const response=await fetch(webUrl+'/versions?bindings_inherit=strict',{method:'POST',headers,body:uploadWeb,signal:AbortSignal.timeout(60000)});
  const result=await response.json();
  if(!response.ok||!result.success)throw Error('Web staging failed '+response.status+' '+JSON.stringify(result.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,400)}))));
  console.log('WEB_STAGED_VERSION',result.result.id??result.result.version?.id,'PREVIOUS',originalWeb);
 }
 const verifyResponse=await fetch(webUrl+'/deployments',{headers,signal:AbortSignal.timeout(30000)});
 const verify=await verifyResponse.json();
 if(verify.result?.deployments?.[0]?.versions?.[0]?.version_id!==originalWeb)throw Error('Live web version changed during stage');
}else if(process.env.RELEASE_PHASE==='publish'){
 throw Error('Publish disabled until staged candidate ID, website bundle and production smoke tests are verified; no production changes made');
}else throw Error('Invalid phase');
