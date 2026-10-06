'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

type Session = {
  id: string;
  name: string;
  status: string;
  phone_number?: string | null;
  display_name?: string | null;
  profile_picture_url?: string | null;
  last_connected_at?: string | null;
};

type BillingSummary = {
  subscription: { plan_code: string; status: string; current_period_end: string };
  usage: { sessions: number; monthlyMessages: number; apiKeys: number };
  limits: { sessions: number; monthlyMessages: number; apiKeys: number };
};

const nav = ['Overview','Sessions','Messages','API Keys','Webhooks','Billing'];

export default function DashboardPage() {
  const [token, setToken] = useState('');
  const [active, setActive] = useState('Overview');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [qr, setQr] = useState<{ dataUrl?: string; available?: boolean } | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('relaywa_access_token') ?? '';
    setToken(saved);
  }, []);

  async function refresh(currentToken = token) {
    if (!currentToken) return;
    setError('');
    try {
      const [sessionRows, billingData, keyRows, webhookRows] = await Promise.all([
        api<Session[]>('/v1/sessions', currentToken),
        api<BillingSummary>('/v1/billing/subscription', currentToken),
        api<any[]>('/v1/api-keys', currentToken),
        api<any[]>('/v1/webhooks', currentToken),
      ]);
      setSessions(sessionRows);
      setBilling(billingData);
      setKeys(keyRows);
      setWebhooks(webhookRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }

  useEffect(() => { void refresh(); }, [token]);

  async function createSession(event: FormEvent) {
    event.preventDefault();
    if (!newSessionName.trim()) return;
    await api('/v1/sessions', token, {
      method: 'POST',
      body: JSON.stringify({ name: newSessionName.trim() }),
    });
    setNewSessionName('');
    await refresh();
  }

  async function connect(sessionId: string) {
    setSelectedSession(sessionId);
    setQr(null);
    setError('');

    try {
      await api(`/v1/sessions/${sessionId}/connect`, token, { method: 'POST' });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const value = await api<any>(`/v1/sessions/${sessionId}/qr`, token);
        setQr(value);
        await refresh();

        if (value.available && value.dataUrl) return;
      }

      setError('QR generation is taking longer than expected. Please try Connect / QR again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start WhatsApp connection');
    }
  }

  const connected = sessions.filter((item) => item.status === 'connected').length;
  const queuedMessages = billing?.usage.monthlyMessages ?? 0;

  const title = active === 'Overview' ? 'Command center' : active;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">rW</div>
          <div><strong>relayWA</strong><span>by BusinessOS</span></div>
        </div>

        <nav>
          {nav.map((item) => (
            <button key={item} className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)}>
              <span className="nav-dot" />{item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-pill"><span className="live-dot" />Platform operational</div>
          <button className="ghost-button" onClick={() => void refresh()}>Refresh data</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><p className="eyebrow">relayWA workspace</p><h1>{title}</h1></div>
          <div className="top-actions">
            <div className="api-badge"><span className="live-dot" />API online</div>
            <div className="avatar">RW</div>
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        {active === 'Overview' && (
          <>
            <section className="hero-panel">
              <div>
                <p className="eyebrow">WhatsApp infrastructure</p>
                <h2>Run every connected session from one reliable control plane.</h2>
                <p className="muted">Monitor connection health, message activity, API access, webhooks and billing without leaving relayWA.</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setActive('Sessions')}>Connect WhatsApp</button>
                  <button className="secondary-button" onClick={() => setActive('API Keys')}>Create API key</button>
                </div>
              </div>
              <div className="signal-orb">
                <div className="orb-core">WA</div>
                <span className="ring ring-a" /><span className="ring ring-b" />
              </div>
            </section>

            <section className="metric-grid">
              <Metric label="Connected sessions" value={String(connected)} detail={`${sessions.length} total sessions`} />
              <Metric label="Messages this month" value={queuedMessages.toLocaleString()} detail={billing ? `${Math.max(0,billing.limits.monthlyMessages-queuedMessages).toLocaleString()} remaining` : 'Loading usage'} />
              <Metric label="API credentials" value={String(keys.length)} detail={billing ? `${billing.limits.apiKeys} plan limit` : 'Secure scoped access'} />
              <Metric label="Webhook endpoints" value={String(webhooks.length)} detail={webhooks.length ? 'Delivery tracking active' : 'No endpoints yet'} />
            </section>

            <section className="two-column">
              <Panel title="Session health" action="Manage" onAction={() => setActive('Sessions')}>
                {sessions.length ? sessions.slice(0,4).map((session) => <SessionRow key={session.id} session={session} />) : <Empty text="No WhatsApp sessions yet." />}
              </Panel>
              <Panel title="Plan & usage" action="Billing" onAction={() => setActive('Billing')}>
                {billing ? (
                  <div className="usage-stack">
                    <div className="plan-line"><strong>{billing.subscription.plan_code}</strong><span>{billing.subscription.status}</span></div>
                    <Usage label="Sessions" used={billing.usage.sessions} limit={billing.limits.sessions} />
                    <Usage label="Messages" used={billing.usage.monthlyMessages} limit={billing.limits.monthlyMessages} />
                    <Usage label="API keys" used={billing.usage.apiKeys} limit={billing.limits.apiKeys} />
                  </div>
                ) : <Empty text="Billing summary unavailable." />}
              </Panel>
            </section>
          </>
        )}

        {active === 'Sessions' && (
          <section className="panel">
            <div className="panel-head"><div><p className="eyebrow">Linked devices</p><h2>WhatsApp sessions</h2></div></div>
            <form className="inline-form" onSubmit={createSession}>
              <input value={newSessionName} onChange={(e)=>setNewSessionName(e.target.value)} placeholder="e.g. Pharmacy support" />
              <button className="primary-button" type="submit">Create session</button>
            </form>
            <div className="session-grid">
              {sessions.map((session) => (
                <article className="session-card" key={session.id}>
                  <div className="session-head">
                    <div className="session-avatar">{session.display_name?.slice(0,2).toUpperCase() || 'WA'}</div>
                    <div><h3>{session.name}</h3><p>{session.phone_number || 'Not linked yet'}</p></div>
                    <Status status={session.status} />
                  </div>
                  <div className="session-meta"><span>Worker-managed</span><span>{session.last_connected_at ? 'Seen recently' : 'Awaiting connection'}</span></div>
                  <div className="session-actions">
                    <button className="secondary-button" onClick={() => void connect(session.id)}>Connect / QR</button>
                  </div>
                  {selectedSession === session.id && qr?.available && qr.dataUrl && (
                    <div className="qr-box"><img src={qr.dataUrl} alt="WhatsApp QR code" /><p>Scan with WhatsApp → Linked devices.</p></div>
                  )}
                </article>
              ))}
              {!sessions.length && <Empty text="Create your first session to generate a QR code." />}
            </div>
          </section>
        )}

        {active === 'Messages' && (
          <section className="panel">
            <div className="panel-head"><div><p className="eyebrow">Traffic</p><h2>Message activity</h2></div></div>
            <div className="activity-table">
              <div className="table-row table-head"><span>Session</span><span>Status</span><span>Phone</span><span>Activity</span></div>
              {sessions.map((s)=><div className="table-row" key={s.id}><span>{s.name}</span><span><Status status={s.status}/></span><span>{s.phone_number || '—'}</span><span>{s.last_connected_at ? 'Realtime events enabled' : 'No recent activity'}</span></div>)}
            </div>
          </section>
        )}

        {active === 'API Keys' && <CollectionPanel title="API credentials" eyebrow="Developer access" items={keys} empty="No API credentials yet." columns={['name','key_prefix','token_type']} />}
        {active === 'Webhooks' && <CollectionPanel title="Webhook endpoints" eyebrow="Event delivery" items={webhooks} empty="No webhook endpoints yet." columns={['name','url','enabled']} />}

        {active === 'Billing' && (
          <section className="panel">
            <div className="panel-head"><div><p className="eyebrow">Subscription</p><h2>Plan & billing</h2></div></div>
            {billing ? <div className="billing-card">
              <div><p className="eyebrow">Current plan</p><h3>{billing.subscription.plan_code}</h3><p className="muted">{billing.subscription.status} · renews {new Date(billing.subscription.current_period_end).toLocaleDateString()}</p></div>
              <div className="usage-stack">
                <Usage label="Sessions" used={billing.usage.sessions} limit={billing.limits.sessions}/>
                <Usage label="Messages" used={billing.usage.monthlyMessages} limit={billing.limits.monthlyMessages}/>
                <Usage label="API keys" used={billing.usage.apiKeys} limit={billing.limits.apiKeys}/>
              </div>
              <div className="billing-actions"><button className="primary-button">Upgrade plan</button><button className="secondary-button">Payment history</button></div>
            </div> : <Empty text="Billing information unavailable." />}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}) {
  return <article className="metric-card"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function Panel({title,action,onAction,children}:{title:string;action:string;onAction:()=>void;children:React.ReactNode}) {
  return <section className="panel"><div className="panel-head"><h2>{title}</h2><button className="text-button" onClick={onAction}>{action} →</button></div>{children}</section>;
}

function SessionRow({session}:{session:Session}) {
  return <div className="session-row"><div className="session-avatar small">{session.display_name?.slice(0,2).toUpperCase() || 'WA'}</div><div className="grow"><strong>{session.name}</strong><span>{session.phone_number || 'Not linked'}</span></div><Status status={session.status}/></div>;
}

function Status({status}:{status:string}) {
  return <span className={`state state-${status}`}><span className="state-dot"/>{status.replace('_',' ')}</span>;
}

function Usage({label,used,limit}:{label:string;used:number;limit:number}) {
  const pct = limit ? Math.min(100, Math.round((used/limit)*100)) : 0;
  return <div className="usage"><div><span>{label}</span><strong>{used.toLocaleString()} / {limit.toLocaleString()}</strong></div><div className="bar"><i style={{width:`${pct}%`}}/></div></div>;
}

function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }

function CollectionPanel({title,eyebrow,items,empty,columns}:{title:string;eyebrow:string;items:any[];empty:string;columns:string[]}) {
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="primary-button">Create</button></div>{items.length ? <div className="activity-table">{items.map((item,index)=><div className="table-row collection-row" key={item.id ?? index}>{columns.map((col)=><span key={col}>{String(item[col] ?? '—')}</span>)}</div>)}</div> : <Empty text={empty}/>}</section>;
}
