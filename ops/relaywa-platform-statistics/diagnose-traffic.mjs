const id=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/relaywa-web',{headers:{Authorization:'Bearer '+t}});
const form=await r.formData();
console.log('MODULES',Array.from(form.keys()).filter(k=>/index.js|traffic|recovery|asset/.test(k)));
for(const name of ['index.js','recovery-assets.mjs']){
 const value=form.get(name); if(!value)continue;const s=typeof value==='string'?value:await value.text();
 for(const needle of ['ASSETS.fetch','env.ASSETS','recovery-assets','assets.fetch','page-traffic-20261013-v1.js','addEventListener','async fetch(','fetch(request']){
  const i=s.indexOf(needle);if(i>=0)console.log('SOURCE',name,needle,'COUNT',s.split(needle).length-1,'SAMPLE',JSON.stringify(s.slice(Math.max(i-230,0),i+310)));
 }
}

const web=await fetch('https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/relaywa-web',{headers:{Authorization:'Bearer '+t}});
const form2=await web.formData();
const source=await form2.get('index.js').text();
for(const needle of ['recoveryAssets[','recoveryAssets.','__relaywaPlatformGateway','path.startsWith(\'/api/','if(path.startsWith','async fetch(request,env,ctx)']){
let start=0,count=0;while(count<5){const at=source.indexOf(needle,start);if(at<0)break;console.log('GATEWAY',needle,'AT',at,JSON.stringify(source.slice(Math.max(0,at-150),at+550)));start=at+needle.length;count++;}
}
