const MARK='RELAYWA_PLATFORM_STATS_UI_V1';
export function patchPlatformPage(original){
 if(original.includes(MARK))throw Error('Already patched');
 const anchor='className:`row-actions`,children:[';
 const at=original.indexOf('All linked sessions');
 if(at<0)throw Error('Platform page signature missing');
 const rowAt=original.indexOf(anchor,at);
 if(rowAt<0||rowAt-at>5000)throw Error('Session row actions not found');
 const marker='(0,c.jsx)(`button`,{className:`mini-button`,onClick:()=>rwPlatformStatistics(e),children:`Statistics`}),';
 const helper=`// RELAYWA_PLATFORM_STATS_UI_V1
async function rwPlatformStatistics(session){
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-label','Message statistics for '+session.name);
 Object.assign(dialog.style,{background:'#101a16',color:'#edf8f0',border:'1px solid #365446',borderRadius:'14px',padding:'24px',maxWidth:'570px',width:'92vw',maxHeight:'85vh',overflowY:'auto'});
 const heading=document.createElement('h2');heading.textContent=session.name+' · Message statistics';dialog.append(heading);
 const close=document.createElement('button');close.textContent='Close';close.style.cssText='float:right;margin-bottom:16px;padding:8px 16px;cursor:pointer';close.onclick=()=>dialog.close();dialog.append(close);
 const body=document.createElement('div');body.style.clear='both';dialog.append(body);
 dialog.onclose=()=>dialog.remove();
 document.body.append(dialog);dialog.showModal();
 function line(label,value){const p=document.createElement('p');p.style.margin='10px 0';const strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(String(value??'—')));body.append(p)}
 function date(value){if(!value)return '—';const s=String(value);const d=new Date(s.includes('T')?s:s.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?s:d.toLocaleString()}
 async function load(){body.replaceChildren();line('Loading','Please wait');
  try{
   const token=localStorage.getItem('relaywa_access_token');
   const response=await fetch('/api/platform/sessions/'+encodeURIComponent(session.id)+'/statistics',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.message||'Unable to load statistics');
   body.replaceChildren();
   for(const [label,value] of [['Total outbound',data.total],['Successfully sent',data.successful],['Failed',data.failed],['Queued / processing',data.pending],['Last successful send',date(data.lastSentAt)],['Last failure',date(data.lastFailedAt)],['Engine',data.engine],['Worker',data.workerId],['Phone',data.phoneNumber],['Last connected',date(data.lastConnectedAt)],['Last disconnected',date(data.lastDisconnectedAt)]])line(label,value);
   const h=document.createElement('h3');h.textContent='Latest outbound message';body.append(h);
   if(data.latestMessage){const m=data.latestMessage;for(const [label,value] of [['Message',String(m.text_body||m.media_caption||'['+m.message_type+']').slice(0,500)],['Recipient',m.recipient_phone],['Status',m.status],['Created',date(m.created_at)],['Sent',date(m.sent_at)],['Last error',m.last_error]])line(label,value)}
   else line('Latest message','No outbound messages recorded');
   const note=document.createElement('small');note.textContent='Sent means accepted by the messaging engine, not necessarily delivered or read.';body.append(note);
  }catch(error){body.replaceChildren();line('Error',error instanceof Error?error.message:'Could not load statistics')}
 }
 const refresh=document.createElement('button');refresh.textContent='Refresh statistics';refresh.style.cssText='margin-top:14px;padding:8px 14px;cursor:pointer';refresh.onclick=()=>void load();dialog.append(refresh);
 await load();
}
`;
 return helper+original.slice(0,rowAt)+original.slice(rowAt).replace(anchor,anchor+marker);
}
export function patchRecoveryAssets(source){
 const prefix='export default ';
 if(!source.startsWith(prefix))throw Error('Recovery asset format changed');
 const assets=JSON.parse(source.slice(prefix.length).trim().replace(/;$/,''));
 const key=Object.keys(assets).filter(x=>typeof assets[x]==='string'&&assets[x].includes('All linked sessions')&&assets[x].includes('session-admin-row'));
 if(key.length!==1)throw Error('Expected exactly one platform page recovery asset; got '+key.length);
 assets[key[0]]=patchPlatformPage(assets[key[0]]);
 return prefix+JSON.stringify(assets)+';\n';
}
