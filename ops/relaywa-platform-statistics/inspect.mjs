const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/';
const headers={Authorization:'Bearer '+token};
for(const name of ['relaywa-platform','relaywa-web']){
 const r=await fetch(root+name,{headers});
 if(!r.ok)throw Error(name+' fetch '+r.status);
 const modules=await r.formData();
 const markers=['All linked sessions','session-admin-row','function sessionsList(env)','/platform/sessions','function Platform','Restart','Logout'];
 for(const [file,blob] of modules.entries()){
  const source=typeof blob==='string'?blob:await blob.text();
  const hits=markers.filter(x=>source.includes(x));
  if(hits.includes('session-admin-row')||hits.includes('All linked sessions')||(name==='relaywa-platform'&&hits.includes('function sessionsList(env)')))
   console.log('MATCH',name,file,source.length,hits.join('|'));
  if(name==='relaywa-web'&&hits.includes('session-admin-row')){
   for(const needle of ['session-admin-row','Logout','All linked sessions']){
    const i=source.indexOf(needle);
    if(i>=0)console.log('NEAR',file,needle,JSON.stringify(source.slice(Math.max(0,i-250),i+450)));
   }
  }
 }
 const d=await fetch(root+name+'/deployments',{headers});
 const info=await d.json();
 console.log('ACTIVE',name,JSON.stringify(info.result?.deployments?.[0]?.versions));
}
