import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {patchWeb,patchRecoveryAssets} from './patch-web.mjs';
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
   if(name==='recovery-assets.mjs'){for(const marker of ['function Qf({view:e=','rw-session-card-actions']){const at=text.indexOf(marker);if(at>=0)console.log('ASSET_SAMPLE',marker,'OFFSET',at,JSON.stringify(text.slice(at-180,at+160)));}}
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
   const after=required.includes(name)?(sourceText.includes('RELAYWA_STATS_UI_V1')?sourceText:(name==='recovery-assets.mjs'?patchRecoveryAssets(sourceText):patchWeb(sourceText))):sourceText;
   if(required.includes(name)){
    const safe='/tmp/relaywa-web-validation.mjs';
    writeFileSync(safe,after);
    const syntax=spawnSync(process.execPath,['--check',safe],{encoding:'utf8'});
    console.log('LOCAL_WEB_SYNTAX',name,syntax.status);
    if(syntax.status!==0){
      const match=String(syntax.stderr).match(/:(\\d+):(\\d+)/);
      const col=Number(match?.[2]??0);
      console.log('WEB_SYNTAX_LOCATION',name,match?.[0]??'unknown','NEIGHBOR',JSON.stringify(after.slice(Math.max(0,col-160),col+160)));
      throw Error('Web candidate JS syntax invalid '+name+' '+String(syntax.stderr).match(/SyntaxError:[^\\n]+/)?.[0]);
    }
   }
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
 
 const expected=[
  {name:'relaywa-api',old:'6f6ee844-9f76-4967-bfc7-0753ccf35cdf',candidate:'a017041e-333d-4bcd-8053-48eb3debb21c'},
  {name:'relaywa-web',old:'96b215ef-8208-4e3f-804d-bc74918d1053',candidate:'e8de7e2a-b4c8-4749-8102-34fac1b438a5'}
 ];
 const base='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/';
 async function cfJson(url,options={}){
  const res=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
  const body=await res.json();
  if(!res.ok||!body.success)throw Error('Cloudflare request failed '+res.status+' '+JSON.stringify(body.errors?.map(x=>x.code)));
  return body.result;
 }
 async function version(name){
  const data=await cfJson(base+name+'/deployments');
  const versions=data.deployments?.[0]?.versions;
  if(versions?.length!==1||versions[0].percentage!==100)throw Error('Unexpected traffic split '+name);
  return versions[0].version_id;
 }
 async function activate(name,target,reason){
  await cfJson(base+name+'/deployments',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({strategy:'percentage',versions:[{version_id:target,percentage:100}],
    annotations:{'workers/message':reason}})});
  if(await version(name)!==target)throw Error('Activation mismatch '+name);
 }
 for(const item of expected){
  if(await version(item.name)!==item.old)throw Error('ABORT: live '+item.name+' version drift');
  const candidate=await cfJson(base+item.name+'/versions/'+item.candidate);
  if(candidate?.id!==item.candidate)throw Error('Candidate version missing '+item.name);
 }
 console.log('PUBLISH_PREFLIGHT_PASSED');
 const activated=[];
 try {
  // Activate API first: the older UI remains compatible with the new read-only endpoint.
  for(const item of expected){await activate(item.name,item.candidate,'RelayWA session message statistics release');activated.push(item);console.log('ACTIVATED',item.name,item.candidate);}
  for(const item of expected)if(await version(item.name)!==item.candidate)throw Error('Post-activation drift '+item.name);
  const health=await fetch('https://relaywa.com/api/health',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const json=await health.json().catch(()=>null);
  if(health.status!==200||json?.status!=='ok'||json?.db!=='up')throw Error('Production API health check failed');
  const authProbe=await fetch('https://relaywa.com/api/whatsapp-sessions/00000000-0000-0000-0000-000000000000/statistics',
    {headers:{'cache-control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(![401,403].includes(authProbe.status))throw Error('Statistics route does not enforce authentication: '+authProbe.status);
  const webProbe=await fetch('https://relaywa.com/login',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if(webProbe.status!==200)throw Error('Customer login page unavailable: '+webProbe.status);
  console.log('CLOUDFLARE_STATISTICS_PRODUCTION_PUBLISHED',expected.map(x=>x.candidate).join(' '));
 } catch(error){
  console.error('PUBLISH_FAILED_AND_ROLLING_BACK',String(error.message).slice(0,260));
  for(const item of activated.reverse())try{await activate(item.name,item.old,'Automatic rollback RelayWA session statistics');console.log('ROLLED_BACK',item.name)}catch(e){console.error('MANUAL_ROLLBACK_REQUIRED',item.name,String(e.message).slice(0,150))}
  throw error;
 }

}else throw Error('Invalid phase');
