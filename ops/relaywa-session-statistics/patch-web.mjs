// Patch the deployed Vinext workspace bundle, preserving all other modules and bindings.
// The same bundle appears in the SSR module and recovered browser asset module.
const MARK='RELAYWA_STATS_UI_V1';
const needle='function Qf({view:e=`dashboard`,sessionId:t})';
export function patchWeb(original){
  if(original.includes(MARK))throw Error('Statistics UI patch is already present');
  const matches=original.split(needle).length-1;
  if(matches!==1)throw Error('Workspace component fingerprint mismatch: '+matches);
  const helper=`// RELAYWA_STATS_UI_V1
function RelaySessionStats({session:e}){
 const [open,setOpen]=(0,m.useState)(false),[data,setData]=(0,m.useState)(null),
 [loading,setLoading]=(0,m.useState)(false),[error,setError]=(0,m.useState)("");
 async function load(){setLoading(true);setError("");try{
  const token=localStorage.getItem("relaywa_access_token");
  const response=await fetch("/api/whatsapp-sessions/"+encodeURIComponent(e.id)+"/statistics",{
   headers:{"authorization":"Bearer "+token},cache:"no-store"
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.message||"Unable to load session statistics");
  setData(result);
 }catch(err){setError(err instanceof Error?err.message:"Unable to load session statistics")}
 finally{setLoading(false)}}
 function date(v){return v?new Date(v.replace&&v.includes(" ")&& !v.includes("T")?v.replace(" ","T")+"Z":v).toLocaleString():"—"}
 function details(label,value){return [(0,f.jsx)("dt",{children:label}),(0,f.jsx)("dd",{style:{overflowWrap:"anywhere",whiteSpace:"pre-wrap"},children:value??"—"})]}
 const content=(0,f.jsxs)("div",{children:[
  (0,f.jsx)("button",{type:"button",className:"rw-button secondary",disabled:loading,onClick:()=>load(),children:loading?"Loading…":"Refresh statistics"}),
  error&&(0,f.jsx)("p",{role:"alert",className:"rw-alert",children:error}),
  data&&(0,f.jsxs)(f.Fragment,{children:[
   (0,f.jsxs)("div",{className:"rw-stats",children:[
    ...[["TOTAL OUTBOUND",data.total],["SUCCESSFULLY SENT",data.successful],["FAILED",data.failed],["QUEUED / PROCESSING",data.pending]].map(([label,value])=>(0,f.jsxs)("article",{children:[(0,f.jsx)("span",{children:label}),(0,f.jsx)("h3",{children:Number(value||0).toLocaleString()})]},label))
   ]}),
   (0,f.jsx)("h3",{children:"Latest outbound message"}),
   data.latestMessage?(0,f.jsx)("dl",{className:"rw-details",children:[
    ...details("Message",String(data.latestMessage.text_body||data.latestMessage.media_caption||"["+data.latestMessage.message_type+"]").slice(0,500)),
    ...details("Recipient",data.latestMessage.recipient_phone),
    ...details("Status",data.latestMessage.status),
    ...details("Created",date(data.latestMessage.created_at)),
    ...details("Sent",date(data.latestMessage.sent_at)),
    ...(data.latestMessage.last_error?details("Error",data.latestMessage.last_error):[])
   ]}):(0,f.jsx)("p",{children:"No outbound messages recorded for this session."}),
   (0,f.jsx)("h3",{children:"Session details"}),
   (0,f.jsx)("dl",{className:"rw-details",children:[
    ...details("Phone",data.phoneNumber||e.phone_hint||"Not linked"),
    ...details("Status",data.status),
    ...details("Engine",data.engine),
    ...details("Last successful send",date(data.lastSentAt)),
    ...details("Last failure",date(data.lastFailedAt)),
    ...details("Last connected",date(data.lastConnectedAt)),
    ...details("Last disconnected",date(data.lastDisconnectedAt)),
    ...details("Session created",date(data.createdAt))
   ]}),
   (0,f.jsx)("p",{children:"Successful means accepted by the messaging engine, not necessarily delivered or read."})
  ]})
 ]});
 return (0,f.jsxs)(f.Fragment,{children:[
  (0,f.jsx)("button",{type:"button",className:"rw-button secondary",onClick:()=>{setOpen(true);void load()},children:"Statistics"}),
  open&&(0,f.jsx)(Zf,{title:e.name+" · Message statistics",onClose:()=>setOpen(false),children:content})
 ]});
}
`;
 return original.replace(needle,helper+needle);
}
