import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;if(!id||!token)throw Error('Missing Cloudflare access');
const root='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token};
async function cf(url,options={}){const response=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(60000)});const body=await response.json();if(!response.ok||!body.success)throw Error('Cloudflare '+response.status+' '+JSON.stringify(body.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,200)}))));return body.result}
async function active(){const d=await cf(root+'/deployments');const v=d.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split');return v[0].version_id;}
const prior='0d3b9a31-06fc-4d54-9052-19e94c732bb0';if(await active()!==prior)throw Error('Production drift');
const existing=await fetch(root,{headers,signal:AbortSignal.timeout(45000)});if(!existing.ok)throw Error('Cannot get Worker');
const modules=await existing.formData(),settings=await cf(root+'/settings'),upload=new FormData();
upload.append('metadata',JSON.stringify({main_module:'index.js',bindings:settings.bindings.map(b=>b.type==='assets'?{type:'assets',name:b.name}:{type:'inherit',name:b.name}),...(settings.compatibility_date?{compatibility_date:settings.compatibility_date}:{}),...(settings.compatibility_flags?{compatibility_flags:settings.compatibility_flags}:{})}));
const mount=readFileSync('ops/relaywa-platform-statistics/proxy-runtime.js','utf8');
const module='export const statsRuntime='+JSON.stringify(mount)+';\n';
let patches=0;
for(const [name,blob] of modules.entries()){
 let src=typeof blob==='string'?blob:await blob.text();
 if(name==='index.js'){
  if(src.includes('relaywa-platform-stats-20261020.js'))throw Error('Already staged');
  src="import {statsRuntime} from './relaywa-stats-runtime.mjs';\n"+src;
  const route='if (p === "/") return Response.redirect(url.origin + "/platform", 302);';
  if(src.split(route).length!==2)throw Error('Proxy route mismatch');
  src=src.replace(route,'if(p==="/relaywa-platform-stats-20261020.js")return new Response(statsRuntime,{headers:{"content-type":"application/javascript; charset=utf-8","cache-control":"no-store"}});\n      '+route);
  const marker='if (url.pathname === "/platform/login" && out.get("content-type")?.includes("text/html")) {';
  if(src.split(marker).length!==2)throw Error('HTML proxy boundary mismatch');
  src=src.replace(marker,`if(url.pathname==="/platform"&&out.get("content-type")?.includes("text/html")){
    out.delete("content-length");out.set("cache-control","no-store");
    return new HTMLRewriter().on("head",{element(el){el.append('<script src="/relaywa-platform-stats-20261020.js" defer></script>',{html:true});}}).transform(new Response(res.body,{status:res.status,headers:out}));
  }
  `+marker);
  writeFileSync('/tmp/relaywa-platform-runtime-check.mjs',src);
  const check=spawnSync(process.execPath,['--check','/tmp/relaywa-platform-runtime-check.mjs'],{encoding:'utf8'});
  if(check.status!==0)throw Error('Platform syntax '+String(check.stderr).slice(-280));
  patches++;
 }
 upload.append(name,new Blob([src],{type:'application/javascript+module'}),name);
}
if(patches!==1||modules.has('relaywa-stats-runtime.mjs'))throw Error('Module layout changed');
upload.append('relaywa-stats-runtime.mjs',new Blob([module],{type:'application/javascript+module'}),'relaywa-stats-runtime.mjs');
const result=await cf(root+'/versions?bindings_inherit=strict',{method:'POST',body:upload});
if(await active()!==prior)throw Error('Production changed');
console.log('STAGED_PLATFORM_PROXY_STATS',result.id??result.version?.id,'PREVIOUS',prior);
