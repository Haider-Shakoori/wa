// Pin both production and staged versions; rollback all changes if smoke verification fails.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/relaywa-platform';
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(path,options={}){
 const r=await fetch(root+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
 const j=await r.json();
 if(!r.ok||!j.success)throw Error('Cloudflare '+r.status+' '+JSON.stringify(j.errors?.map(x=>x.code)));
 return j.result;
}
async function active(){
 const d=await cf('/deployments'),v=d.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic split');
 return v[0].version_id;
}
async function activate(version,message){
 await cf('/deployments',{method:'POST',body:JSON.stringify({
  strategy:'percentage',versions:[{version_id:version,percentage:100}],
  annotations:{'workers/message':message}
 })});
 if(await active()!==version)throw Error('Worker activation mismatch');
}
const prior='d3c86ec8-9223-475b-be51-90d158e86410',next='4f84250b-a1c4-4e7a-a463-b78fcdfe0ef1';
if(await active()!==prior)throw Error('Live platform Worker changed; abort');
if((await cf('/versions/'+next)).id!==next)throw Error('Inactive candidate missing');
let switched=false;
try{
 await activate(next,'RelayWA bounded platform administrator session renewal');switched=true;
 let propagated=false;
 for(let i=1;i<=12;i++){
  const html=await fetch('https://platform.relaywa.com/platform?authRelease='+Date.now(),{
   headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  const doc=await html.text();
  const js=await fetch('https://platform.relaywa.com/relaywa-admin-renew-v1.js?authRelease='+Date.now(),{
   headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
  const code=await js.text();
  propagated=html.status===200&&doc.includes('relaywa-admin-renew-v1.js')&&doc.includes('relaywa-platform-stats-20261020.js')&&
    js.status===200&&code.includes('__relaywaAdminSessionRenewV1')&&code.includes('/api/auth/refresh');
  console.log('EDGE_VERIFY',i,html.status,js.status,propagated);
  if(propagated)break;
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!propagated)throw Error('Browser renewal script did not reach platform edge');
 const sameOrigin=await fetch('https://platform.relaywa.com/api/auth/refresh',{
  method:'POST',headers:{origin:'https://platform.relaywa.com','content-type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(12000)});
 console.log('NO_COOKIE_REFRESH',sameOrigin.status);
 if(sameOrigin.status!==401)throw Error('Missing refresh cookie not rejected');
 const hostile=await fetch('https://platform.relaywa.com/api/auth/refresh',{
  method:'POST',headers:{origin:'https://invalid.example','content-type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(12000)});
 console.log('CROSS_ORIGIN_REFRESH',hostile.status);
 if(hostile.status!==403)throw Error('Foreign refresh request not denied');
 const auth=await fetch('https://platform.relaywa.com/api/auth/me',{signal:AbortSignal.timeout(12000)});
 if(auth.status!==401)throw Error('Unauthenticated admin access was not denied');
 console.log('RELAYWA_SESSION_RENEWAL_PRODUCTION_VERIFIED',next);
}catch(error){
 console.error('RELEASE_FAILED',String(error.message).slice(0,300));
 if(switched)try{await activate(prior,'Automatic rollback: RelayWA session renewal');console.log('AUTO_ROLLBACK_COMPLETE');}
 catch(e){console.error('MANUAL_ROLLBACK_REQUIRED',String(e.message).slice(0,180));}
 throw error;
}
