'use client';

import { FormEvent, useState } from 'react';
import { api } from '../lib/api';

type BotAnswer = {
  title:string;
  reply:string;
  highlights:string[];
  actions:{label:string;section:string}[];
  intent:string;
  generatedAt:string;
};

const suggestions = [
  'Why are some WhatsApp sessions disconnected?',
  'Show message queue and failure health',
  'What are the current Safety Governor limits?',
  'Are my workers healthy?',
  'Any webhook delivery problems?',
  'Show subscription and payment health',
];

export function PlatformSupportBot({
  token,
  onNavigate,
}:{
  token:string;
  onNavigate:(section:string)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [history,setHistory]=useState<{question:string;answer:BotAnswer}[]>([]);

  async function ask(question:string) {
    const clean=question.trim();
    if (!clean || !token) return;
    setBusy(true);
    setError('');
    try {
      const answer=await api<BotAnswer>('/v1/platform/support/ask',token,{
        method:'POST',
        body:JSON.stringify({message:clean}),
      });
      setHistory((items)=>[...items,{question:clean,answer}]);
      setMessage('');
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Unable to reach RelayWA Ops Assistant');
    } finally {
      setBusy(false);
    }
  }

  function submit(event:FormEvent) {
    event.preventDefault();
    void ask(message);
  }

  return <>
    <button
      className={open?'ops-bot-launcher active':'ops-bot-launcher'}
      onClick={()=>setOpen((value)=>!value)}
      aria-label="Open RelayWA Ops Assistant"
    >
      <span className="ops-bot-icon">R</span>
      <span><strong>Ops Assistant</strong><small>Platform support</small></span>
      <i>{open?'×':'↑'}</i>
    </button>

    {open && <aside className="ops-bot-panel">
      <header className="ops-bot-head">
        <div className="ops-bot-avatar">R</div>
        <div><strong>RelayWA Ops Assistant</strong><span><i/>Live platform context</span></div>
        <button onClick={()=>setOpen(false)} aria-label="Close support assistant">×</button>
      </header>

      <div className="ops-bot-body">
        {!history.length && <div className="ops-bot-welcome">
          <span className="ops-bot-spark">✦</span>
          <h3>How can I help with RelayWA?</h3>
          <p>I can inspect live session, queue, worker, billing, webhook, engine and Safety Governor state. I’m read-only and won’t execute destructive actions.</p>
          <div className="ops-bot-suggestions">
            {suggestions.map((item)=><button key={item} onClick={()=>void ask(item)} disabled={busy}>{item}</button>)}
          </div>
        </div>}

        {history.map((item,index)=><div className="ops-bot-turn" key={index}>
          <div className="ops-user-message">{item.question}</div>
          <div className="ops-bot-answer">
            <div className="ops-answer-title"><span className="ops-bot-avatar tiny">R</span><strong>{item.answer.title}</strong></div>
            <p>{item.answer.reply}</p>
            {!!item.answer.highlights?.length && <ul>{item.answer.highlights.map((highlight)=><li key={highlight}>{highlight}</li>)}</ul>}
            {!!item.answer.actions?.length && <div className="ops-bot-actions">
              {item.answer.actions.map((action)=><button key={action.label} onClick={()=>{onNavigate(action.section);setOpen(false)}}>{action.label} →</button>)}
            </div>}
          </div>
        </div>)}

        {busy && <div className="ops-bot-thinking"><span/><span/><span/>Inspecting platform state</div>}
        {error && <div className="ops-bot-error">{error}</div>}
      </div>

      <form className="ops-bot-compose" onSubmit={submit}>
        <input value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Ask about sessions, queues, errors, billing…" maxLength={500}/>
        <button disabled={busy || !message.trim()} aria-label="Send question">↑</button>
      </form>
      <footer>Private platform assistant · read-only diagnostics</footer>
    </aside>}
  </>;
}
