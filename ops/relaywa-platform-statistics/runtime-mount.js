(() => {
  if (window.__relaywaStatsReady) return;
  window.__relaywaStatsReady = true;
  let sessionCache = [], lastFetch = 0, busy = false;
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
    const modal=document.createElement('dialog');
    modal.style.cssText='background:#111a15;color:#f1f9f3;border:1px solid #385243;border-radius:14px;padding:22px;width:min(560px,94vw);max-height:85vh;overflow:auto';
    modal.setAttribute('aria-label','Session statistics');
    const title=document.createElement('h2');title.textContent=session.name+' — Message statistics';modal.append(title);
    const close=document.createElement('button');close.textContent='Close';close.onclick=()=>modal.close();modal.append(close);
    const content=document.createElement('div');modal.append(content);
    const refresh=document.createElement('button');refresh.textContent='Refresh';modal.append(refresh);
    modal.onclose=()=>modal.remove();document.body.append(modal);modal.showModal();
    async function load() {
      content.replaceChildren();line(content,'Loading','Statistics');
      try {
        const r=await fetch('/api/platform/sessions/'+encodeURIComponent(session.id)+'/statistics',{headers:{authorization:'Bearer '+auth()},cache:'no-store'});
        const d=await r.json();if(!r.ok)throw Error(d.message||'Statistics request failed');
        content.replaceChildren();
        for(const [k,v] of [['Total outbound',d.total],['Successfully sent',d.successful],['Failed',d.failed],['Queued / processing',d.pending],['Last successful send',time(d.lastSentAt)],['Last failure',time(d.lastFailedAt)],['Engine',d.engine],['Worker',d.workerId],['Last connected',time(d.lastConnectedAt)]])line(content,k,v);
        const m=d.latestMessage;line(content,'Last message',m?(m.text_body||m.media_caption||'['+m.message_type+']'):'None');
        if(m){line(content,'Recipient',m.recipient_phone);line(content,'Message status',m.status);line(content,'Created',time(m.created_at));line(content,'Sent',time(m.sent_at));if(m.last_error)line(content,'Error',m.last_error);}
        const note=document.createElement('small');note.textContent='Sent means accepted by the messaging engine, not necessarily delivered or read.';content.append(note);
      } catch(e) {content.replaceChildren();line(content,'Error',e.message);}
    }
    refresh.onclick=()=>void load();void load();
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