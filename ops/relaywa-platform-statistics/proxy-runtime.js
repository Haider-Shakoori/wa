(() => {
  if (window.__relaywaStatsReady) return;
  window.__relaywaStatsReady = true;
  let sessionCache = [], lastFetch = 0, busy = false;
  const style = document.createElement('style');
  style.dataset.relaywaSessionDesign='v2';
  style.textContent = `
  .session-admin-row:not(.platform-row-head){min-height:88px;transition:background .15s ease,border-color .15s ease}
  .session-admin-row:not(.platform-row-head):hover{background:rgba(31,170,103,.055)}
  .session-admin-row .row-actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
  .session-admin-row .row-actions .mini-button{border-radius:9px;min-height:36px;padding:8px 11px;font-weight:650;white-space:nowrap}
  .session-admin-row .row-actions [data-relaywa-stats]{background:rgba(24,195,118,.13);color:#5bf0a3;border:1px solid rgba(48,208,133,.35);display:inline-flex;align-items:center;gap:6px}
  .session-admin-row .row-actions [data-relaywa-stats]:hover{background:rgba(24,195,118,.22)}
  .session-admin-row .phone-cell{font-variant-numeric:tabular-nums;letter-spacing:.012em}
  .session-admin-row strong{font-weight:700}
  .rw2-modal{background:#0e1613;color:#eaf8ef;border:1px solid #335141;border-radius:18px;padding:0;width:min(720px,calc(100vw - 24px));max-height:min(88vh,900px);box-shadow:0 30px 85px #000b;overflow:auto}
  .rw2-modal::backdrop{background:rgba(0,0,0,.77);backdrop-filter:blur(5px)}
  .rw2-head{position:sticky;top:0;z-index:1;background:#101b16;border-bottom:1px solid #293d32;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .rw2-head h2{font-size:20px;line-height:1.25;margin:0}.rw2-subtitle{font-size:12px;color:#a9c5b5;margin-top:5px}
  .rw2-close{border:1px solid #395744;color:#e7f9ee;background:#19291f;border-radius:9px;width:36px;height:36px;cursor:pointer;font-size:21px}
  .rw2-body{padding:22px 24px 26px}
  .rw2-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:22px}
  .rw2-stat{background:#17241c;border:1px solid #304838;border-radius:12px;padding:14px}
  .rw2-label{color:#9db9a8;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
  .rw2-number{font-size:27px;font-weight:800;line-height:1.25;margin-top:8px;font-variant-numeric:tabular-nums}
  .rw2-success{color:#57eaa0}.rw2-failure{color:#ff9098}.rw2-pending{color:#eacc88}
  .rw2-section{border:1px solid #2c4235;border-radius:12px;padding:16px;margin-top:14px}
  .rw2-section h3{font-size:14px;margin:0 0 13px;font-weight:750;color:#eefbf4}
  .rw2-details{display:grid;grid-template-columns:minmax(110px,38%) minmax(0,1fr);gap:11px 14px;margin:0}
  .rw2-details dt{color:#99b5a5;font-size:12px}.rw2-details dd{margin:0;color:#f2fcf5;font-size:13px;overflow-wrap:anywhere;white-space:pre-wrap}
  .rw2-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}
  .rw2-note{color:#94b1a1;font-size:11px;max-width:480px}
  .rw2-refresh{background:#0a9e63;border:1px solid #1ab878;border-radius:9px;padding:10px 15px;color:white;font-weight:750;cursor:pointer}
  .rw2-refresh:disabled{opacity:.55;cursor:wait}
  .rw2-error{border:1px solid #a74755;background:#381b20;color:#ffb1ba;padding:14px;border-radius:10px}
  @media(max-width:800px){.rw2-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.rw2-body{padding:16px}.rw2-head{padding:16px}.session-admin-row .row-actions{gap:5px}}
  @media(max-width:390px){.rw2-number{font-size:22px}.rw2-details{grid-template-columns:1fr}.rw2-details dd{margin-bottom:8px}}
  `;
  document.head.append(style);
  const auth = () => localStorage.getItem('relaywa_access_token') || '';
  async function sessions() {
    if (busy || Date.now() - lastFetch < 5000) return sessionCache;
    if (!auth()) return [];
    busy = true;
    try {
      const r = await fetch('/api/platform/sessions', {headers:{authorization:'Bearer '+auth()},cache:'no-store'});
      if (r.ok) { const data = await r.json(); if (Array.isArray(data)) sessionCache = data; lastFetch = Date.now(); }
    } catch (_) {} finally { busy = false; }
    return sessionCache;
  }
  function line(root,key,value) {
    const p=document.createElement('p');p.style.cssText='margin:8px 0;overflow-wrap:anywhere;white-space:pre-wrap';
    const b=document.createElement('strong');b.textContent=key+': ';p.append(b,document.createTextNode(String(value??'—')));root.append(p);
  }
  function time(x) { if (!x) return '—';const d=new Date(String(x).includes('T')?x:String(x).replace(' ','T')+'Z');return isNaN(d.getTime())?String(x):d.toLocaleString(); }
  async function openStats(session) {
    const modal=document.createElement('dialog');modal.className='rw2-modal';modal.setAttribute('aria-label','Message statistics for '+session.name);
    const head=document.createElement('div');head.className='rw2-head';modal.append(head);
    const titleWrap=document.createElement('div');head.append(titleWrap);
    const title=document.createElement('h2');title.textContent=session.name;titleWrap.append(title);
    const subtitle=document.createElement('div');subtitle.className='rw2-subtitle';subtitle.textContent='WhatsApp session · Message statistics';titleWrap.append(subtitle);
    const close=document.createElement('button');close.className='rw2-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close statistics');close.onclick=()=>modal.close();head.append(close);
    const content=document.createElement('div');content.className='rw2-body';modal.append(content);
    modal.onclose=()=>modal.remove();document.body.append(modal);modal.showModal();close.focus();
    function el(parent,tag,textValue,className){const node=document.createElement(tag);if(textValue!=null)node.textContent=String(textValue);if(className)node.className=className;parent.append(node);return node}
    function details(parent,fields){const dl=el(parent,'dl',null,'rw2-details');for(const [name,value] of fields){el(dl,'dt',name);el(dl,'dd',value??'—')}}
    async function load(){
      content.replaceChildren();el(content,'p','Loading session statistics…','rw2-subtitle');
      try{
        const response=await fetch('/api/platform/sessions/'+encodeURIComponent(session.id)+'/statistics',{headers:{authorization:'Bearer '+auth()},cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.message||'Unable to retrieve statistics');
        if(!modal.isConnected)return;
        content.replaceChildren();
        const grid=el(content,'div',null,'rw2-cards');
        for(const [name,value,klass] of [['Total sent requests',data.total,''],['Successful',data.successful,'rw2-success'],['Failed',data.failed,'rw2-failure'],['Pending',data.pending,'rw2-pending']]){
          const card=el(grid,'div',null,'rw2-stat');el(card,'div',name,'rw2-label');el(card,'div',Number(value||0).toLocaleString(),'rw2-number '+klass);
        }
        const message=el(content,'section',null,'rw2-section');el(message,'h3','Latest outbound message');
        const m=data.latestMessage;
        if(m)details(message,[['Message',String(m.text_body||m.media_caption||'['+(m.message_type||'message')+']').slice(0,500)],['Recipient',m.recipient_phone],['Status',m.status],['Created',time(m.created_at)],['Sent',time(m.sent_at)],...(m.last_error?[['Error',m.last_error]]:[])]);
        else el(message,'p','No outbound messages have been recorded.','rw2-subtitle');
        const section=el(content,'section',null,'rw2-section');el(section,'h3','Connection and activity');
        details(section,[['Phone',data.phoneNumber||'Not linked'],['Engine',data.engine],['Worker',data.workerId],['Status',data.status],['Last successful send',time(data.lastSentAt)],['Last failure',time(data.lastFailedAt)],['Last connected',time(data.lastConnectedAt)],['Last disconnected',time(data.lastDisconnectedAt)]]);
        const footer=el(content,'div',null,'rw2-footer');
        el(footer,'div','Successful indicates accepted by the messaging engine, not delivery or read confirmation.','rw2-note');
        const refresh=el(footer,'button','↻ Refresh','rw2-refresh');refresh.type='button';refresh.onclick=()=>void load();
      }catch(error){if(!modal.isConnected)return;content.replaceChildren();el(content,'div',error instanceof Error?error.message:'Could not load statistics','rw2-error');const retry=el(content,'button','Try again','rw2-refresh');retry.onclick=()=>void load();}
    }
    void load();
  }
  async function mount() {
    const rows=Array.from(document.querySelectorAll('.session-admin-row:not(.platform-row-head)'));
    if (!rows.length) return;
    const records=await sessions();
    for(const row of rows) {
      const actions=row.querySelector('.row-actions');if(!actions||actions.querySelector('[data-relaywa-stats]'))continue;
      const name=row.children[0]?.querySelector('strong')?.textContent?.trim();
      const phone=(row.children[2]?.textContent||'').replace(/\D/g,'');
      const matches=records.filter(s=>s.name===name&&(!phone||String(s.phone_number||'').replace(/\D/g,'')===phone));
      if(matches.length!==1)continue;
      const button=document.createElement('button');button.type='button';button.className='mini-button';button.dataset.relaywaStats='1';button.textContent='Statistics';button.onclick=()=>void openStats(matches[0]);actions.prepend(button);
    }
  }
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;void mount()},300);}
  const obs=new MutationObserver(schedule);
  function start(){obs.observe(document.body,{subtree:true,childList:true});schedule()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();