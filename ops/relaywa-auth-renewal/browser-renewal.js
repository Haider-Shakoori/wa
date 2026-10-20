// Browser-side token renewal, limited to the authenticated Platform Admin page.
(() => {
 if(window.__relaywaAdminSessionRenewV1)return;
 window.__relaywaAdminSessionRenewV1=true;
 const key='relaywa_access_token',rawFetch=window.fetch.bind(window);
 let pending=null,signingOut=false,releaseEvent=false;
 const expiry=token=>{try{const s=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number(s.exp)*1000||0;}catch{return 0;}};
 async function renew(){
  if(signingOut||!localStorage.getItem(key))return null;
  if(pending)return pending;
  const before=localStorage.getItem(key);
  pending=(async()=>{try{
    const r=await rawFetch('/api/auth/refresh',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'}});
    if(!r.ok)return null;
    const d=await r.json();
    if(!d.accessToken||!expiry(d.accessToken)||signingOut||localStorage.getItem(key)!==before)return null;
    localStorage.setItem(key,d.accessToken);return d.accessToken;
  }catch{return null;}})();
  try{return await pending;}finally{pending=null;}
 }
 function check(){
  if(document.hidden||signingOut)return;
  const t=localStorage.getItem(key);
  if(t&&expiry(t)&&expiry(t)-Date.now()<300000)void renew();
 }
 window.fetch=async(input,init)=>{
  const original=new Request(input,init);
  const url=new URL(original.url,location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname==='/api/auth/refresh'||url.pathname==='/api/auth/logout')
   return rawFetch(input,init);
  const authorization=original.headers.get('authorization');
  if(!authorization||!authorization.toLowerCase().startsWith('bearer '))return rawFetch(input,init);
  const latest=localStorage.getItem(key);
  if(!latest||signingOut)return rawFetch(input,init);
  if(expiry(latest)&&expiry(latest)-Date.now()<90000)await renew();
  const token=localStorage.getItem(key)||latest;
  function request(value){const h=new Headers(original.headers);h.set('authorization','Bearer '+value);return new Request(original.clone(),{headers:h});}
  let response=await rawFetch(request(token));
  if(response.status===401&&!signingOut){
   const fresh=await renew();
   if(fresh&&fresh!==token)response=await rawFetch(request(fresh));
  }
  return response;
 };
 document.addEventListener('click',event=>{
  if(event.target?.closest?.('.account-logout')){
   signingOut=true;
   void rawFetch('/api/auth/logout',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'content-type':'application/json'}}).catch(()=>{});
  }
 },true);
 function resume(event){
  if(releaseEvent){releaseEvent=false;return;}
  const t=localStorage.getItem(key);
  if(!t||!expiry(t)||expiry(t)>Date.now()){check();return;}
  event?.stopImmediatePropagation?.();
  void renew().then(fresh=>{
   if(!fresh&&!signingOut){releaseEvent=true;
    if(event?.type==='visibilitychange')document.dispatchEvent(new Event('visibilitychange'));
    else window.dispatchEvent(new Event('focus'));
   }
  });
 }
 window.addEventListener('focus',resume,true);
 window.addEventListener('pageshow',resume,true);
 document.addEventListener('visibilitychange',e=>{if(!document.hidden)resume(e)},true);
 setInterval(check,60000);
 check();
})();