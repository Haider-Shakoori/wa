'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DeveloperGuide } from '../../components/developer-guide';
import { MessageHistory, OnboardingChecklist, QuickSend } from '../../components/customer-operations';
import { api } from '../../lib/api';

type Session = {
  id:string;
  name:string;
  status:string;
  phone_number?:string|null;
  display_name?:string|null;
  profile_picture_url?:string|null;
  last_connected_at?:string|null;
};

type BillingSummary = {
  subscription:{ plan_code:string; status:string; current_period_end:string };
  usage:{ sessions:number; monthlyMessages:number; apiKeys:number };
  limits:{ sessions:number; monthlyMessages:number; apiKeys:number };
};

const nav = ['Overview','Sessions','Messages','API Keys','Developers','Webhooks','Billing'];

export default function DashboardPage() {
  const [token,setToken] = useState('');
  const [active,setActive] = useState('Overview');
  const [sessions,setSessions] = useState<Session[]>([]);
  const [billing,setBilling] = useState<BillingSummary|null>(null);
  const [keys,setKeys] = useState<any[]>([]);
  const [webhooks,setWebhooks] = useState<any[]>([]);
  const [payments,setPayments] = useState<any[]>([]);
  const [error,setError] = useState('');
  const [newSessionName,setNewSessionName] = useState('');
  const [qr,setQr] = useState<{dataUrl?:string;available?:boolean}|null>(null);
  const [selectedSession,setSelectedSession] = useState<string|null>(null);
  const [connectionNotice,setConnectionNotice] = useState<{sessionId:string;phone?:string|null;name?:string|null}|null>(null);

  useEffect(()=>{
    setToken(localStorage.getItem('relaywa_access_token') ?? '');
  },[]);

  async function refresh(currentToken = token) {
    if (!currentToken) return;
    setError('');
    try {
      const [sessionRows,billingData,keyRows,webhookRows,paymentRows] = await Promise.all([
        api<Session[]>('/v1/sessions',currentToken),
        api<BillingSummary>('/v1/billing/subscription',currentToken),
        api<any[]>('/v1/api-keys',currentToken),
        api<any[]>('/v1/webhooks',currentToken),
        api<any[]>('/v1/billing/payments',currentToken),
      ]);
      setSessions(sessionRows);
      setBilling(billingData);
      setKeys(keyRows);
      setWebhooks(webhookRows);
      setPayments(paymentRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }

  useEffect(()=>{ void refresh(); },[token]);

  useEffect(()=>{
    if (!token) return;
    const timer = setInterval(()=>{
      if (active === 'Sessions' || sessions.some((item)=>['connecting','need_scan','reconnecting'].includes(item.status))) {
        void refresh();
      }
    },5000);
    return ()=>clearInterval(timer);
  },[token,active,sessions]);

  async function createSession(event:FormEvent) {
    event.preventDefault();
    if (!newSessionName.trim()) return;
    try {
      await api('/v1/sessions',token,{
        method:'POST',
        body:JSON.stringify({name:newSessionName.trim()}),
      });
      setNewSessionName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create session');
    }
  }

  async function connect(sessionId:string) {
    setSelectedSession(sessionId);
    setQr(null);
    setConnectionNotice(null);
    setError('');

    try {
      await api('/v1/sessions/' + sessionId + '/connect',token,{method:'POST'});

      for (let attempt=0; attempt<20; attempt+=1) {
        await sleep(500);
        const value = await api<any>('/v1/sessions/' + sessionId + '/qr',token);
        setQr(value);
        await refresh();

        if (value.available && value.dataUrl) {
          void watchConnectedSession(sessionId);
          return;
        }

        if (value.status === 'connected') {
          await finishConnection(sessionId);
          return;
        }
      }

      setError('QR generation is taking longer than expected. Please try Connect / QR again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start WhatsApp connection');
    }
  }

  async function watchConnectedSession(sessionId:string) {
    for (let attempt=0; attempt<90; attempt+=1) {
      await sleep(1000);
      try {
        const current = await api<Session>('/v1/sessions/' + sessionId,token);
        setSessions((items)=>items.map((item)=>item.id===sessionId?current:item));

        if (current.status === 'connected') {
          setQr(null);
          setConnectionNotice({
            sessionId,
            phone:current.phone_number,
            name:current.display_name,
          });
          await refresh();
          return;
        }

        if (current.status === 'error' || current.status === 'logged_out') {
          setError(current.status === 'error' ? 'WhatsApp connection failed. Try connecting again.' : 'WhatsApp logged out. Scan a new QR code.');
          return;
        }
      } catch {
        // Keep polling while the worker finishes profile synchronization.
      }
    }
    setError('The QR was scanned but profile synchronization is taking longer than expected. Refresh the session list.');
  }

  async function finishConnection(sessionId:string) {
    const current = await api<Session>('/v1/sessions/' + sessionId,token);
    setQr(null);
    setSessions((items)=>items.map((item)=>item.id===sessionId?current:item));
    setConnectionNotice({sessionId,phone:current.phone_number,name:current.display_name});
  }

  async function sessionAction(sessionId:string, action:'restart'|'logout') {
    setError('');
    if (action === 'logout' && !window.confirm('Log this WhatsApp account out of relayWA? A new QR scan will be required to reconnect.')) return;
    try {
      await api('/v1/sessions/' + sessionId + '/' + action,token,{method:'POST'});
      await sleep(800);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update WhatsApp session');
    }
  }

  const connected = sessions.filter((item)=>item.status==='connected').length;
  const monthlyMessages = billing?.usage.monthlyMessages ?? 0;
  const title = active === 'Overview' ? 'Command center' : active;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">rW</div><div><strong>relayWA</strong><span>by BusinessOS</span></div></div>
      <nav>{nav.map((item)=><button key={item} className={active===item?'nav-item active':'nav-item'} onClick={()=>setActive(item)}><span className="nav-dot"/>{item}</button>)}</nav>
      <div className="sidebar-bottom"><div className="status-pill"><span className="live-dot"/>Platform operational</div><button className="ghost-button" onClick={()=>void refresh()}>Refresh data</button></div>
    </aside>

    <main className="content">
      <header className="topbar saas-topbar">
        <div><p className="eyebrow">Customer workspace</p><h1>{title}</h1></div>
        <div className="top-actions">
          <button className="command-search" onClick={()=>setActive('Developers')}><span>⌘</span> Search docs & integrations</button>
          <button className="secondary-button" onClick={()=>setActive('Messages')}>Send message</button>
          <div className="api-badge"><span className="live-dot"/>API online</div>
          <div className="avatar">RW</div>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {active === 'Overview' && <>
        <section className="workspace-banner">
          <div>
            <span className="product-kicker"><span className="live-dot"/>WhatsApp infrastructure online</span>
            <h2>Everything you need to connect WhatsApp to your software.</h2>
            <p>Manage linked numbers, test delivery, issue API credentials, monitor usage and ship your integration from one workspace.</p>
          </div>
          <div className="workspace-actions">
            <button className="primary-button" onClick={()=>setActive('Messages')}>Send test message</button>
            <button className="secondary-button" onClick={()=>setActive('Developers')}>Open developer center</button>
          </div>
        </section>

        <section className="metric-grid saas-metrics">
          <Metric label="Connected numbers" value={String(connected)} detail={sessions.length + ' provisioned sessions'}/>
          <Metric label="Messages this month" value={monthlyMessages.toLocaleString()} detail={billing ? Math.max(0,billing.limits.monthlyMessages-monthlyMessages).toLocaleString() + ' remaining' : 'Loading usage'}/>
          <Metric label="API credentials" value={String(keys.length)} detail={billing ? String(billing.limits.apiKeys) + ' available on plan' : 'Scoped access'}/>
          <Metric label="Webhooks" value={String(webhooks.length)} detail={webhooks.length?'Event delivery configured':'Add your first endpoint'}/>
        </section>

        <section className="dashboard-v2-grid">
          <OnboardingChecklist sessions={sessions} keys={keys} webhooks={webhooks} onNavigate={setActive}/>
          <QuickSend token={token} sessions={sessions} onSent={()=>refresh()}/>
        </section>

        <section className="two-column">
          <Panel title="Connected numbers" action="Manage" onAction={()=>setActive('Sessions')}>{sessions.length?sessions.slice(0,5).map((session)=><SessionRow key={session.id} session={session}/>):<Empty text="No WhatsApp sessions yet."/>}</Panel>
          <Panel title="Plan & usage" action="Billing" onAction={()=>setActive('Billing')}>{billing?<div className="usage-stack"><div className="plan-line"><strong>{billing.subscription.plan_code}</strong><span>{billing.subscription.status}</span></div><Usage label="Sessions" used={billing.usage.sessions} limit={billing.limits.sessions}/><Usage label="Messages" used={billing.usage.monthlyMessages} limit={billing.limits.monthlyMessages}/><Usage label="API keys" used={billing.usage.apiKeys} limit={billing.limits.apiKeys}/></div>:<Empty text="Billing summary unavailable."/>}</Panel>
        </section>
      </>}

      {active === 'Sessions' && <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">Linked devices</p><h2>WhatsApp sessions</h2><p className="muted panel-subtitle">After QR scan, relayWA automatically refreshes the session and displays the linked WhatsApp number.</p></div></div>
        <form className="inline-form" onSubmit={createSession}><input value={newSessionName} onChange={(e)=>setNewSessionName(e.target.value)} placeholder="e.g. Pharmacy support"/><button className="primary-button" type="submit">Create session</button></form>
        <div className="session-grid">
          {sessions.map((session)=><article className="session-card" key={session.id}>
            <div className="session-head">
              <div className="session-avatar">{session.display_name?.slice(0,2).toUpperCase()||'WA'}</div>
              <div><h3>{session.name}</h3><p className={session.phone_number?'connected-number':''}>{session.phone_number?'+' + session.phone_number:'Not linked yet'}</p>{session.display_name && <small className="session-profile-name">{session.display_name}</small>}</div>
              <Status status={session.status}/>
            </div>

            <div className="session-meta"><span>Worker-managed</span><span>{session.last_connected_at?'Connected profile synchronized':'Awaiting connection'}</span></div>

            {session.status !== 'connected' && <div className="session-actions"><button className="secondary-button" onClick={()=>void connect(session.id)}>Connect / QR</button></div>}

            {session.status === 'connected' && <><div className="connected-banner"><strong>WhatsApp connected</strong><div>{session.phone_number?'Number: +' + session.phone_number:'Connected — synchronizing number…'}</div>{session.display_name && <small>{session.display_name}</small>}</div><div className="session-control-row"><button className="secondary-button" onClick={()=>void sessionAction(session.id,'restart')}>Restart</button><button className="danger-button" onClick={()=>void sessionAction(session.id,'logout')}>Log out</button></div></>}

            {connectionNotice?.sessionId===session.id && session.status==='connected' && <div className="connected-banner"><strong>QR scan completed</strong><div>{connectionNotice.phone?'Linked number: +' + connectionNotice.phone:'Linked successfully. Number is synchronizing.'}</div></div>}

            {selectedSession===session.id && qr?.available && qr.dataUrl && <div className="qr-box"><img src={qr.dataUrl} alt="WhatsApp QR code"/><p>Scan with WhatsApp → Linked devices. Keep this page open; the number will appear automatically after connection.</p></div>}
          </article>)}
          {!sessions.length && <Empty text="Create your first session to generate a QR code."/>}
        </div>
      </section>}

      {active === 'Messages' && <div className="messages-workspace"><QuickSend token={token} sessions={sessions} onSent={()=>refresh()}/><MessageHistory token={token} sessions={sessions}/></div>}

      {active === 'API Keys' && <section className="panel"><div className="panel-head"><div><p className="eyebrow">Developer access</p><h2>API credentials</h2><p className="muted panel-subtitle">Keys are scoped, revocable and shown in full only once when created.</p></div><button className="primary-button" onClick={()=>setActive('Developers')}>Create key / Guide</button></div>{keys.length?<div className="activity-table">{keys.map((key)=><div className="table-row collection-row" key={key.id}><span>{key.name}</span><span>{key.key_prefix}…</span><span>{key.token_type}</span></div>)}</div>:<Empty text="No API credentials yet. Open the Developer guide to create one."/>}</section>}

      {active === 'Developers' && <DeveloperGuide token={token} sessions={sessions} keys={keys} onRefresh={()=>refresh()}/>}

      {active === 'Webhooks' && <CollectionPanel title="Webhook endpoints" eyebrow="Event delivery" items={webhooks} empty="No webhook endpoints yet." columns={['name','url','enabled']}/>}

      {active === 'Billing' && <section className="billing-workspace"><section className="panel"><div className="panel-head"><div><p className="eyebrow">Subscription</p><h2>Plan & usage</h2></div></div>{billing?<div className="billing-card"><div><p className="eyebrow">Current plan</p><h3>{billing.subscription.plan_code}</h3><p className="muted">{billing.subscription.status} · period ends {new Date(billing.subscription.current_period_end).toLocaleDateString()}</p></div><div className="usage-stack"><Usage label="Sessions" used={billing.usage.sessions} limit={billing.limits.sessions}/><Usage label="Messages" used={billing.usage.monthlyMessages} limit={billing.limits.monthlyMessages}/><Usage label="API keys" used={billing.usage.apiKeys} limit={billing.limits.apiKeys}/></div></div>:<Empty text="Billing information unavailable."/>}</section><section className="panel"><div className="panel-head"><div><p className="eyebrow">Payments</p><h2>Payment history</h2></div></div><div className="payment-list">{payments.slice(0,12).map((payment)=><div className="payment-row" key={payment.id}><div><strong>{payment.plan_code} · {payment.billing_interval}</strong><small>{new Date(payment.created_at).toLocaleString()}</small></div><span>{((payment.amount_cents||0)/100).toFixed(2)} {payment.currency}</span><Status status={payment.status}/></div>)}{!payments.length&&<Empty text="No payments yet."/>}</div></section></section>}
    </main>
  </div>;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}) { return <article className="metric-card"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>; }
function Panel({title,action,onAction,children}:{title:string;action:string;onAction:()=>void;children:React.ReactNode}) { return <section className="panel"><div className="panel-head"><h2>{title}</h2><button className="text-button" onClick={onAction}>{action} →</button></div>{children}</section>; }
function SessionRow({session}:{session:Session}) { return <div className="session-row"><div className="session-avatar small">{session.display_name?.slice(0,2).toUpperCase()||'WA'}</div><div className="grow"><strong>{session.name}</strong><span>{session.phone_number?'+' + session.phone_number:'Not linked'}</span></div><Status status={session.status}/></div>; }
function Status({status}:{status:string}) { return <span className={'state state-' + status}><span className="state-dot"/>{status.replace('_',' ')}</span>; }
function Usage({label,used,limit}:{label:string;used:number;limit:number}) { const pct=limit?Math.min(100,Math.round((used/limit)*100)):0; return <div className="usage"><div><span>{label}</span><strong>{used.toLocaleString()} / {limit.toLocaleString()}</strong></div><div className="bar"><i style={{width:String(pct) + '%'}}/></div></div>; }
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }
function CollectionPanel({title,eyebrow,items,empty,columns}:{title:string;eyebrow:string;items:any[];empty:string;columns:string[]}) { return <section className="panel"><div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>{items.length?<div className="activity-table">{items.map((item,index)=><div className="table-row collection-row" key={item.id??index}>{columns.map((col)=><span key={col}>{String(item[col]??'—')}</span>)}</div>)}</div>:<Empty text={empty}/>}</section>; }
function sleep(ms:number) { return new Promise((resolve)=>setTimeout(resolve,ms)); }
