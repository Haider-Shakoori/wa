import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token};
async function cf(path,options={}){
 const response=await fetch(url+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});
 const data=await response.json();
 if(!response.ok||!data.success)throw Error('Cloudflare '+response.status+': '+JSON.stringify(data.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,120)}))));
 return data.result;
}
async function active(){
 const d=await cf('/deployments');const v=d.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected live traffic split');
 return v[0].version_id;
}
const previous='4f84250b-a1c4-4e7a-a463-b78fcdfe0ef1';
if(await active()!==previous)throw Error('Production platform Worker changed, abort');
const live=await fetch(url,{headers,signal:AbortSignal.timeout(60000)});
if(!live.ok)throw Error('Unable to fetch current Worker');
const modules=await live.formData(),settings=await cf('/settings');
if(!modules.has('relaywa-stats-runtime.mjs'))throw Error('Statistics runtime module missing from live Worker');
const ui=readFileSync('ops/relaywa-platform-statistics/proxy-runtime.js','utf8');
const syntax=spawnSync(process.execPath,['--check','ops/relaywa-platform-statistics/proxy-runtime.js'],{encoding:'utf8'});
if(syntax.status!==0)throw Error('Responsive runtime syntax check failed: '+String(syntax.stderr).slice(-240));
for(const marker of ['@media (max-width: 800px)','@media (max-width: 390px)','rw3-session-card','rw3-sessions-table','decorateSessionRows','data-relaywa-stats','rw2-modal']){
 if(!ui.includes(marker))throw Error('Missing required UI marker: '+marker);
}
const form=new FormData();
form.append('metadata',JSON.stringify({
 main_module:'index.js',
 bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),
 ...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),
 ...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{}),
 annotations:{'workers/message':'RelayWA responsive platform Sessions cards staged inactive'}
}));
for(const [name,value] of modules.entries()){
 let source=typeof value==='string'?value:await value.text();
 if(name==='relaywa-stats-runtime.mjs')source='export const statsRuntime='+JSON.stringify(ui)+';\n';
 form.append(name,new Blob([source],{type:'application/javascript+module'}),name);
}
const newVersion=await cf('/versions?bindings_inherit=strict',{method:'POST',body:form});
if(await active()!==previous)throw Error('Production changed during staging');
console.log('STAGED_MOBILE_SESSION_LAYOUT',newVersion.id??newVersion.version?.id,'PREVIOUS',previous);
