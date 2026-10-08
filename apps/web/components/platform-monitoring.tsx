'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type MonitoringOverview = {
  generatedAt: string;
  notificationDelivery: { emailConfigured:boolean };
  sessions: { total:number; connected:number; reconnecting:number; offline:number; stale_leases:number };
  webhooks24h: { failed:number; queued:number; delivered:number };
  failedMessages24h: number;
  alerts30d: { total:number; unacknowledged:number; critical:number };
  workers: Array<{ worker_id:string; owned_sessions:number; connected_sessions:number;
    reconnecting_sessions:number; lease_expires_at:string|null; leaseActive:boolean }>;
};
type MonitoringAlert = {
  id:string; event_type:string; severity:'info'|'warning'|'critical';
  subject:string; summary:string; status:string; created_at:string;
  organization_id:string|null; session_id:string|null; acknowledged_at:string|null;
  acknowledged_by_email:string|null; sent_at:string|null;
};

export function PlatformMonitoring({token,role}:{token:string;role:string}) {
  const [overview,setOverview]=useState<MonitoringOverview|null>(null);
  const [alerts,setAlerts]=useState<MonitoringAlert[]>([]);
  const [severity,setSeverity]=useState('');
  const [ackFilter,setAckFilter]=useState('open');
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const canAcknowledge=role==='super_admin'||role==='support_admin';

  const reload=useCallback(async()=>{
    if(!token)return;
    try{
      const params=new URLSearchParams({severity,acknowledgement:ackFilter});
      const [health,items]=await Promise.all([
        api<MonitoringOverview>('/platform/monitoring/overview',token),
        api<MonitoringAlert[]>('/platform/monitoring/alerts?'+params.toString(),token),
      ]);
      setOverview(health);setAlerts(items);setError('');
    }catch(err){setError(err instanceof Error?err.message:'Unable to load platform monitoring');}
    finally{setLoading(false);}
  },[token,severity,ackFilter]);

  useEffect(()=>{
    setLoading(true);
    void reload();
    const timer=window.setInterval(()=>void reload(),60_000);
    return ()=>window.clearInterval(timer);
  },[reload]);

  async function setAcknowledged(alert:MonitoringAlert,acknowledged:boolean){
    if(!canAcknowledge||busy)return;
    setBusy(alert.id);setError('');
    try{
      await api('/platform/monitoring/alerts/'+encodeURIComponent(alert.id)+'/acknowledgement',token,{
        method:'PATCH',body:JSON.stringify({acknowledged}),
      });
      await reload();
    }catch(err){setError(err instanceof Error?err.message:'Unable to update alert');}
    finally{setBusy(null);}
  }

  const value=(number:number|undefined)=>Number(number??0).toLocaleString();
  return <section className="platform-monitoring" aria-label="Platform system monitoring">
    <div className="panel platform-monitoring-head">
      <div><p className="eyebrow">Phase 7 · Operations intelligence</p>
        <h2>Monitoring & incident alerts</h2>
        <p className="muted">Live platform signals, refreshed every minute. Acknowledging an alert does not cancel its notification delivery.</p>
        {overview&&<small>Last updated {new Date(overview.generatedAt).toLocaleTimeString()}</small>}
        {overview&&<small className={overview.notificationDelivery.emailConfigured?'platform-email-status-ready':'platform-email-status-missing'}>
          Email alert delivery: {overview.notificationDelivery.emailConfigured?'Configured':'Not configured — alerts are still recorded here'}
        </small>}
      </div>
      <button className="secondary-button" disabled={loading} onClick={()=>void reload()}>
        {loading?'Loading…':'↻ Refresh'}
      </button>
    </div>
    {error&&<div className="alert" role="alert">{error}</div>}
    <div className="platform-monitoring-cards">
      <div className="panel"><span>Connected sessions</span><strong>{value(overview?.sessions.connected)} / {value(overview?.sessions.total)}</strong><small>{value(overview?.sessions.reconnecting)} reconnecting · {value(overview?.sessions.offline)} offline</small></div>
      <div className="panel"><span>Stale worker leases</span><strong>{value(overview?.sessions.stale_leases)}</strong><small>Sessions with expired worker claims</small></div>
      <div className="panel"><span>Failed webhooks · 24h</span><strong>{value(overview?.webhooks24h.failed)}</strong><small>{value(overview?.webhooks24h.queued)} queued · {value(overview?.webhooks24h.delivered)} delivered</small></div>
      <div className="panel"><span>Unacknowledged alerts</span><strong>{value(overview?.alerts30d.unacknowledged)}</strong><small>{value(overview?.alerts30d.critical)} critical · last 30 days</small></div>
    </div>
    <div className="panel">
      <h3>Worker lease health</h3>
      <p className="muted">A stale lease indicates a potentially interrupted WhatsApp worker; a healthy lease is not proof of end-to-end message delivery.</p>
      {overview?.workers?.length?overview.workers.map(worker=><div className="platform-monitoring-row" key={worker.worker_id}>
        <span><strong>{worker.worker_id}</strong><small>{worker.owned_sessions} owned · {worker.connected_sessions} connected · {worker.reconnecting_sessions} reconnecting</small></span>
        <span className={'platform-monitoring-state '+(worker.leaseActive?'is-healthy':'is-critical')}>
          {worker.leaseActive?'Lease active':'Lease expired'}
        </span>
      </div>):<p className="muted">No active worker leases have been registered.</p>}
    </div>
    <div className="panel">
      <div className="platform-monitoring-alerts-head">
        <div><h3>Alert center</h3><p className="muted">Recent alerts are retained even after email delivery. Acknowledgement is tracked separately.</p></div>
        <div className="platform-monitoring-filters">
          <label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value)}>
            <option value="">All</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
          </select></label>
          <label>Review<select value={ackFilter} onChange={e=>setAckFilter(e.target.value)}>
            <option value="open">Unacknowledged</option><option value="acknowledged">Acknowledged</option><option value="">All</option>
          </select></label>
        </div>
      </div>
      {alerts.map(alert=><div key={alert.id} className="platform-monitoring-row platform-monitoring-alert">
        <div className="platform-monitoring-alert-copy">
          <div><span className={'platform-alert-severity '+alert.severity}>{alert.severity}</span><strong>{alert.subject}</strong></div>
          <p>{alert.summary}</p>
          <small>{alert.event_type} · {new Date(alert.created_at).toLocaleString()} · Notification: {alert.status}</small>
          {alert.acknowledged_at&&<small>Reviewed {new Date(alert.acknowledged_at).toLocaleString()}{alert.acknowledged_by_email?' by '+alert.acknowledged_by_email:''}</small>}
        </div>
        {canAcknowledge&&<button className="mini-button" disabled={Boolean(busy)}
          onClick={()=>void setAcknowledged(alert,!Boolean(alert.acknowledged_at))}>
          {busy===alert.id?'Saving…':alert.acknowledged_at?'Reopen':'Acknowledge'}
        </button>}
      </div>)}
      {!alerts.length&&!loading&&<p className="muted">No alerts match these filters.</p>}
    </div>
  </section>;
}
