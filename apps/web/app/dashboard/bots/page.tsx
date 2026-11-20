'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

type Bot = {id:string;name:string;session_id:string;mode:string};
type Session = {id:string;name:string;status:string};
type Entitlement = {entitled:boolean;plan:string|null;maxBots:number;monthlyReplyLimit:number};
type Faq = {id:string;question:string;answer:string;aliases:string[]};

export default function BotsPage() {
 const router=useRouter();
 const [token,setToken]=useState('');
 const [entitlement,setEntitlement]=useState<Entitlement|null>(null);
 const [sessions,setSessions]=useState<Session[]>([]);
 const [bots,setBots]=useState<Bot[]>([]);
 const [selected,setSelected]=useState('');
 const [faqs,setFaqs]=useState<Faq[]>([]);
 const [name,setName]=useState('');
 const [sessionId,setSessionId]=useState('');
 const [question,setQuestion]=useState('');
 const [answer,setAnswer]=useState('');
 const [testQuestion,setTestQuestion]=useState('');
 const [preview,setPreview]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const current=bots.find(b=>b.id===selected);
 async function refresh(t:string) {
   const access=await api<Entitlement>('/bots/entitlement',t);
   setEntitlement(access);
   if(!access.entitled){setBots([]);setSessions([]);return;}
   const [nextBots,nextSessions]=await Promise.all([
     api<Bot[]>('/bots',t),api<Session[]>('/whatsapp-sessions',t)
   ]);
   setBots(nextBots);setSessions(nextSessions);
 }
 useEffect(()=>{
   const t=localStorage.getItem('relaywa_access_token');
   if(!t){router.replace('/login');return;}
   setToken(t);
   api('/auth/me',t).then(()=>refresh(t)).catch(e=>setError(e instanceof Error?e.message:'Unable to load bots'))
     .finally(()=>setLoading(false));
 },[router]);
 useEffect(()=>{
   if(!selected||!token){setFaqs([]);return;}
   let cancelled=false;
   api<Faq[]>('/bots/'+encodeURIComponent(selected)+'/faqs',token)
     .then(items=>{if(!cancelled)setFaqs(items);})
     .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Unable to load FAQs');});
   return ()=>{cancelled=true;};
 },[selected,token]);
 async function purchase(planCode:'starter'|'pro'|'business'){
   if(!token||busy)return;
   setBusy(true);setError('');
   try{
     const result=await api<{checkoutUrl:string;orderId:string}>('/bots/checkout',token,{
       method:'POST',body:JSON.stringify({planCode})
     });
     const url=new URL(result.checkoutUrl);
     if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')
       throw new Error('Unexpected Stripe Checkout destination');
     window.location.assign(url.toString());
   }catch(e){setError(e instanceof Error?e.message:'Unable to start Bot Builder checkout');setBusy(false);}
 }
 async function create(e:FormEvent) {
   e.preventDefault();if(!entitlement?.entitled)return;setBusy(true);setError('');
   try {
     const bot=await api<Bot>('/bots',token,{method:'POST',body:JSON.stringify({name,sessionId})});
     await refresh(token);setSelected(bot.id);setName('');setSessionId('');
   }catch(e){setError(e instanceof Error?e.message:'Could not create bot');}
   finally{setBusy(false);}
 }
 async function addFaq(e:FormEvent){
   e.preventDefault();if(!selected||!entitlement?.entitled)return;setBusy(true);setError('');
   try{
     const faq=await api<Faq>('/bots/'+encodeURIComponent(selected)+'/faqs',token,{
       method:'POST',body:JSON.stringify({question,answer})
     });
     setFaqs(items=>[...items,faq]);setQuestion('');setAnswer('');
   }catch(e){setError(e instanceof Error?e.message:'Could not save FAQ');}
   finally{setBusy(false);}
 }
 async function removeFaq(id:string){
   if(!selected||!entitlement?.entitled)return;setBusy(true);setError('');
   try{
     await api('/bots/'+encodeURIComponent(selected)+'/faqs/'+encodeURIComponent(id),token,{method:'DELETE'});
     setFaqs(items=>items.filter(item=>item.id!==id));
   }catch(e){setError(e instanceof Error?e.message:'Could not delete FAQ');}
   finally{setBusy(false);}
 }
 function testFaq(e:FormEvent){
   e.preventDefault();
   const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase()
     .replace(/[ً-ٰٟ]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک')
     .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
   const match=faqs.find(f=>normalize(f.question)===normalize(testQuestion)||
     (f.aliases||[]).some(alias=>normalize(alias)===normalize(testQuestion)));
   setPreview(match?match.answer:'No matching FAQ. A live bot would not send an invented answer.');
 }
 const inputStyle={width:'100%',padding:'10px 12px',border:'1px solid #cbd5e1',borderRadius:8,background:'transparent',color:'inherit'};
 return <main style={{maxWidth:1040,margin:'0 auto',padding:'32px 20px',fontFamily:'inherit'}}>
   <nav style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:24}}>
     <Link href="/dashboard">← Dashboard</Link><strong>RelayWA · Bot Builder</strong>
   </nav>
   <h1>WhatsApp Bot Builder</h1>
   <p>Configure FAQs safely. All bots remain in standby; no WhatsApp messages are sent from this page.</p>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   {loading?<p role="status">Loading bot workspace…</p>:entitlement&&!entitlement.entitled?<section style={{border:'1px solid #cbd5e1',borderRadius:12,padding:24}}>
     <h2>Unlock Bot Builder</h2><p>Bot Builder requires a separate paid add-on. Your existing WhatsApp sessions are unaffected.</p>
     <div style={{display:'grid',gap:12}}>
       {([
         {code:'starter',label:'Starter',price:5,bots:1,replies:'1,000'},
         {code:'pro',label:'Pro',price:12,bots:3,replies:'5,000'},
         {code:'business',label:'Business',price:25,bots:10,replies:'20,000'},
       ] as const).map(plan=><div key={plan.code} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',border:'1px solid #cbd5e1',borderRadius:8,padding:12}}>
         <span><strong>{plan.label} — ${plan.price}/month</strong><br/>{plan.bots} bot{plan.bots>1?'s':''} · {plan.replies} replies/month</span>
         <button type="button" disabled={busy||!token} onClick={()=>purchase(plan.code)}
           style={{padding:'10px 16px',borderRadius:8,cursor:busy?'wait':'pointer'}}>
           {busy?'Please wait…':'Subscribe'}
         </button>
       </div>)}
     </div>
     <p>Bot Builder is a separate monthly subscription. Checkout uses Stripe; no WhatsApp messages are sent by this page.</p>
     <Link href="/subscription">View current RelayWA subscription</Link>
   </section>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:24}}>
     <section style={{display:'grid',gap:16,alignContent:'start'}}>
       <h2>Create bot</h2>
       <form onSubmit={create} style={{display:'grid',gap:10}}>
         <label>Bot name<input style={inputStyle} required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
         <label>WhatsApp session<select style={inputStyle} required value={sessionId} onChange={e=>setSessionId(e.target.value)}>
           <option value="">Select a session</option>
           {sessions.map(s=><option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
         </select></label>
         <button disabled={busy||!sessionId} type="submit">Create standby bot</button>
       </form>
       <h2>My bots</h2>
       {bots.length===0?<p>No bots yet.</p>:bots.map(b=><button key={b.id} type="button"
         onClick={()=>{setSelected(b.id);setPreview('');}} aria-pressed={selected===b.id}
         style={{textAlign:'left',padding:12,border:'1px solid #cbd5e1',borderRadius:8,
           background:selected===b.id?'rgba(100,116,139,.14)':'transparent',color:'inherit'}}>
         <strong>{b.name}</strong><span style={{display:'block'}}>Mode: {b.mode}</span>
       </button>)}
     </section>
     <section style={{display:'grid',gap:16,alignContent:'start'}}>
       <h2>{current?current.name:'Select a bot'}</h2>
       {current&&<>
         <p><strong>Standby only.</strong> No live replies, session transfers or worker commands.</p>
         <h3>Add FAQ</h3>
         <form onSubmit={addFaq} style={{display:'grid',gap:10}}>
           <label>Customer question<input style={inputStyle} required maxLength={500} value={question} onChange={e=>setQuestion(e.target.value)}/></label>
           <label>Approved answer<textarea style={inputStyle} required maxLength={4000} rows={3} value={answer} onChange={e=>setAnswer(e.target.value)}/></label>
           <button disabled={busy} type="submit">Save FAQ</button>
         </form>
         <h3>Knowledge base · {faqs.length} FAQs</h3>
         {faqs.map(f=><article key={f.id} style={{border:'1px solid #cbd5e1',borderRadius:8,padding:12}}>
           <strong>{f.question}</strong><p style={{whiteSpace:'pre-wrap'}}>{f.answer}</p>
           <button disabled={busy} type="button" onClick={()=>void removeFaq(f.id)}>Delete FAQ</button>
         </article>)}
         <h3>Test answer (local preview)</h3>
         <form onSubmit={testFaq} style={{display:'grid',gap:10}}>
           <label>Example customer message<input style={inputStyle} value={testQuestion} onChange={e=>setTestQuestion(e.target.value)} required/></label>
           <button type="submit">Preview response</button>
         </form>
         {preview&&<p role="status" style={{whiteSpace:'pre-wrap',border:'1px solid #cbd5e1',padding:12,borderRadius:8}}>{preview}</p>}
       </>}
     </section>
   </div>}
 </main>;
}
