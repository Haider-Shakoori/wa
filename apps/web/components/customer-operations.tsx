'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Session = {
  id:string;
  name:string;
  status:string;
  phone_number?:string|null;
  display_name?:string|null;
};

export function OnboardingChecklist({
  sessions,
  keys,
  webhooks,
  onNavigate,
}:{
  sessions:Session[];
  keys:any[];
  webhooks:any[];
  onNavigate:(section:string)=>void;
}) {
  const connected = sessions.some((session)=>session.status === 'connected');
  const steps = [
    { label:'Connect WhatsApp', done:connected, section:'Sessions', detail:connected?'A WhatsApp account is linked.':'Scan a QR and link your first number.' },
    { label:'Create an API key', done:keys.length>0, section:'Developers', detail:keys.length?'Developer credentials are ready.':'Create a scoped key for your application.' },
    { label:'Send your first message', done:false, section:'Messages', detail:'Use the live test console before integrating your app.' },
    { label:'Add a webhook', done:webhooks.length>0, section:'Webhooks', detail:webhooks.length?'Event delivery is configured.':'Receive message and session events in your app.' },
  ];
  const complete = steps.filter((item)=>item.done).length;

  return <section className="saas-card onboarding-card">
    <div className="saas-card-head">
      <div><p className="eyebrow">Getting started</p><h3>Launch your relayWA workspace</h3></div>
      <div className="progress-ring"><strong>{complete}/4</strong><span>complete</span></div>
    </div>
    <div className="onboarding-steps">
      {steps.map((step,index)=><button key={step.label} className={step.done?'onboarding-step done':'onboarding-step'} onClick={()=>onNavigate(step.section)}>
        <span className="step-index">{step.done?'✓':index+1}</span>
        <span><strong>{step.label}</strong><small>{step.detail}</small></span>
        <span className="step-arrow">→</span>
      </button>)}
    </div>
  </section>;
}

export function QuickSend({
  token,
  sessions,
  onSent,
}:{
  token:string;
  sessions:Session[];
  onSent?:()=>Promise<void>|void;
}) {
  const connected = useMemo(()=>sessions.filter((session)=>session.status==='connected'),[sessions]);
  const [sessionId,setSessionId] = useState('');
  const [to,setTo] = useState('');
  const [text,setText] = useState('Hello from relayWA');
  const [status,setStatus] = useState('');
  const [sending,setSending] = useState(false);

  useEffect(()=>{
    if (!sessionId && connected[0]) setSessionId(connected[0].id);
  },[connected,sessionId]);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setStatus('');
    setSending(true);
    try {
      if (!sessionId) throw new Error('Choose a connected WhatsApp session.');
      const result = await api<any>('/whatsapp-sessions/' + sessionId + '/messages/text',token,{
        method:'POST',
        body:JSON.stringify({
          to,
          text,
          clientMessageId:'portal-test-' + Date.now(),
        }),
      });
      setStatus('Queued successfully · ' + result.id);
      await onSent?.();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to queue test message');
    } finally {
      setSending(false);
    }
  }

  return <section className="saas-card quick-send-card">
    <div className="saas-card-head"><div><p className="eyebrow">API playground</p><h3>Send a live test message</h3></div><span className="live-chip"><span className="live-dot"/>Real delivery</span></div>
    <form className="quick-send-form" onSubmit={submit}>
      <label>WhatsApp session
        <select value={sessionId} onChange={(e)=>setSessionId(e.target.value)} required>
          <option value="">Choose connected session</option>
          {connected.map((session)=><option value={session.id} key={session.id}>{session.name}{session.phone_number?' · +' + session.phone_number:''}</option>)}
        </select>
      </label>
      <label>Recipient number
        <input value={to} onChange={(e)=>setTo(e.target.value)} placeholder="e.g. 12025550123" minLength={7} required/>
      </label>
      <label className="quick-send-message">Message
        <textarea value={text} onChange={(e)=>setText(e.target.value)} maxLength={4096} required/>
      </label>
      <button className="primary-button" disabled={sending || !connected.length} type="submit">{sending?'Sending…':'Send test message'}</button>
      {!connected.length && <p className="form-hint">Connect a WhatsApp session before sending a test message.</p>}
      {status && <p className="form-status">{status}</p>}
    </form>
  </section>;
}

export function MessageHistory({
  token,
  sessions,
}:{
  token:string;
  sessions:Session[];
}) {
  const connected = sessions.filter((session)=>session.status==='connected');
  const [sessionId,setSessionId] = useState('');
  const [messages,setMessages] = useState<any[]>([]);
  const [error,setError] = useState('');

  useEffect(()=>{
    if (!sessionId && sessions[0]) setSessionId(sessions[0].id);
  },[sessions,sessionId]);

  useEffect(()=>{
    if (!token || !sessionId) return;
    void load();
  },[token,sessionId]);

  async function load() {
    try {
      setError('');
      const rows=await api<any[]>('/whatsapp-sessions/' + sessionId + '/messages',token);
      setMessages(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages');
    }
  }

  return <section className="saas-card">
    <div className="saas-card-head">
      <div><p className="eyebrow">Activity</p><h3>Recent message traffic</h3></div>
      <div className="inline-actions">
        <select value={sessionId} onChange={(e)=>setSessionId(e.target.value)}>
          <option value="">Choose session</option>
          {sessions.map((session)=><option key={session.id} value={session.id}>{session.name}</option>)}
        </select>
        <button className="icon-button" onClick={()=>void load()}>↻</button>
      </div>
    </div>
    {error && <div className="alert">{error}</div>}
    <div className="message-feed">
      {messages.slice(0,12).map((message)=><div className="message-feed-row" key={message.id}>
        <span className={'message-direction ' + (message.direction==='inbound'?'inbound':'outbound')}>{message.direction==='inbound'?'IN':'OUT'}</span>
        <div><strong>{message.recipient_phone || message.sender_phone || 'WhatsApp'}</strong><small>{message.text_body || message.message_type || 'Message'}</small></div>
        <div className="message-feed-meta"><span className={'state state-' + message.status}><span className="state-dot"/>{message.status}</span><small>{new Date(message.created_at).toLocaleString()}</small></div>
      </div>)}
      {!messages.length && <div className="empty">No message activity for this session yet.</div>}
    </div>
  </section>;
}
