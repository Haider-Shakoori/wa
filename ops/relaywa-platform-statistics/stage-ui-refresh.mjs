import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform',headers={authorization:'Bearer '+token};
async function cf(path,opt={}){const r=await fetch(root+path,{...opt,headers:{...headers,...opt.headers},signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(x=>({code:x.code,message:String(x.message).slice(0,200)}))));return j.result;}
async function live(){const d=await cf('/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split');return v[0].version_id;}
const previous='e41e6786-2795-428c-b261-541f3c659f20';
if(await live()!==previous)throw Error('Production platform Worker changed');
const response=await fetch(root,{headers,signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Could not retrieve live Worker');
const modules=await response.formData(),settings=await cf('/settings');
if(!modules.has('relaywa-stats-runtime.mjs'))throw Error('Missing existing runtime module');
const enhanced=readFileSync('ops/relaywa-platform-statistics/proxy-runtime.js','utf8');
const syntax=spawnSync(process.execPath,['--check','ops/relaywa-platform-statistics/proxy-runtime.js'],{encoding:'utf8'});
if(syntax.status!==0)throw Error('UI syntax invalid '+String(syntax.stderr).slice(-450));
for(const marker of ['rw2-modal','rw2-cards','data-relaywa-stats','Message statistics'])if(!enhanced.includes(marker))throw Error('Missing UI marker '+marker);
const metadata={main_module:'index.js',bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{})};
const form=new FormData();form.append('metadata',JSON.stringify(metadata));
for(const [name,value] of modules.entries()){
 let data=typeof value==='string'?value:await value.text();
 if(name==='relaywa-stats-runtime.mjs')data='export const statsRuntime='+JSON.stringify(enhanced)+';\n';
 form.append(name,new Blob([data],{type:'application/javascript+module'}),name);
}
const staged=await cf('/versions?bindings_inherit=strict',{method:'POST',body:form});
if(await live()!==previous)throw Error('Production changed during staging');
console.log('STAGED_SESSION_UI_REFRESH',staged.id??staged.version?.id,'PREVIOUS',previous);
