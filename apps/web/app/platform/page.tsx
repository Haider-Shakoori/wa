'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function PlatformPage() {
  const [token,setToken] = useState('');
  const [overview,setOverview] = useState<any>(null);
  const [tenants,setTenants] = useState<any[]>([]);
  const [workers,setWorkers] = useState<any[]>([]);
  const [queues,setQueues] = useState<any>(null);
  const [errors,setErrors] = useState<any>(null);
  const [error,setError] = useState('');

  useEffect(()=>setToken(localStorage.getItem('relaywa_access_token') ?? ''),[]);

  async function refresh(current = token) {
    if (!current) return;
    setError('');
    try {
      const [o,t,w,q,e] = await Promise.all([
        api('/v1/platform/overview',current),
        api('/v1/platform/tenants',current),
        api('/v1/platform/workers',current),
        api('/v1/platform/queues',current),
        api('/v1/platform/errors',current),
      ]);
      setOverview(o); setTenants(t as any[]); setWorkers(w as any[]); setQueues(q); setErrors(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform operations');
    }
  }

  useEffect(()=>{ void refresh(); },[token]);

  return <main className="content platform-page">
    <header className="topbar">
      <div><p className="eyebrow">relayWA platform</p><h1>Operations center</h1></div>
      <button className="secondary-button" onClick={()=>void refresh()}>Refresh</button>
    </header>
    {error && <div className="alert">{error}</div>}
    <section className="metric-grid">
      <Metric label="Organizations" value={overview?.organizations ?? 0}/>
      <Metric label="Users" value={overview?.users ?? 0}/>
      <Metric label="Connected sessions" value={overview?.sessions?.connected ?? 0}/>
      <Metric label="Failed webhooks" value={overview?.failedWebhooks ?? 0}/>
    </section>

    <section className="two-column">
      <Panel title="Worker health">
        {workers.length ? workers.map((w)=><div className="session-row" key={w.worker_id}><div className="grow"><strong>{w.worker_id}</strong><span>{w.connected_sessions} connected · {w.owned_sessions} owned</span></div><span className="state state-connected"><span className="state-dot"/>leased</span></div>) : <Empty text="No active workers found."/>}
      </Panel>
      <Panel title="Queue health">
        <pre className="ops-pre">{JSON.stringify(queues ?? {},null,2)}</pre>
      </Panel>
    </section>

    <section className="panel" style={{marginTop:14}}>
      <div className="panel-head"><div><p className="eyebrow">Tenants</p><h2>Organizations</h2></div></div>
      <div className="activity-table">
        <div className="table-row table-head"><span>Name</span><span>Plan</span><span>Sessions</span><span>Subscription</span></div>
        {tenants.map((t)=><div className="table-row" key={t.id}><span>{t.name}</span><span>{t.plan_code ?? '—'}</span><span>{t.sessions}</span><span>{t.subscription_status ?? '—'}</span></div>)}
      </div>
    </section>

    <section className="panel" style={{marginTop:14}}>
      <div className="panel-head"><div><p className="eyebrow">Diagnostics</p><h2>Recent errors</h2></div></div>
      <pre className="ops-pre">{JSON.stringify(errors ?? {},null,2)}</pre>
    </section>
  </main>;
}

function Metric({label,value}:{label:string;value:number|string}) {
  return <article className="metric-card"><p>{label}</p><strong>{value}</strong><span>Platform-wide</span></article>;
}
function Panel({title,children}:{title:string;children:React.ReactNode}) {
  return <section className="panel"><div className="panel-head"><h2>{title}</h2></div>{children}</section>;
}
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }
