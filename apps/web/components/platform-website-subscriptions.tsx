'use client';

import { useState } from 'react';
import type { ClientPlan } from './platform-client-subscription-editor';

type Subscriber = {
  organization_id:string;
  organization_name:string;
  plan_code:string;
  status:string;
  effective_status?:string;
  current_period_end:string;
  provider:string|null;
  max_sessions:number;
};
type Payment = {
  id:string;
  organization_id?:string;
  organization_name:string;
  provider:string;
  plan_code:string;
  billing_interval:string;
  amount_cents:number;
  currency:string;
  status:string;
  created_at:string;
};
const readable=(date:string)=>date?new Date(date).toLocaleDateString():'—';
const cost=(cents:number,currency='USD')=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:currency||'USD',maximumFractionDigits:2,
}).format((Number(cents)||0)/100);

export function PlatformWebsiteSubscriptions({plans,subscriptions,payments,clientCount,onManage,onPayments}:{
  plans:ClientPlan[];
  subscriptions:Subscriber[];
  payments:Payment[];
  clientCount:number;
  onManage:(organizationId:string)=>void;
  onPayments:()=>void;
}) {
  const [status,setStatus]=useState<'all'|'active'|'trialing'|'attention'>('all');
  const [search,setSearch]=useState('');
  const [annual,setAnnual]=useState(false);
  const known=subscriptions.filter(s=>!!s.organization_id);
  const matching=known.filter(item=>{
    const effective=item.effective_status??item.status;
    return (status==='all'||(status==='attention'?!['active','trialing'].includes(effective):effective===status))
      && (!search.trim()||[item.organization_name,item.plan_code,item.provider,effective]
        .some(value=>String(value??'').toLowerCase().includes(search.toLowerCase().trim())));
  });
  const paid=payments.filter(p=>p.status==='paid');
  const active=known.filter(s=>(s.effective_status??s.status)==='active').length;
  const trial=known.filter(s=>(s.effective_status??s.status)==='trialing').length;
  const attention=known.filter(s=>!['active','trialing'].includes(s.effective_status??s.status)).length;

  return <section className="website-subscriptions" aria-label="Website subscriptions">
    <div className="panel website-subscriptions-head">
      <div>
        <p className="eyebrow">RelayWA.com · Website billing</p>
        <h2>Website subscriptions</h2>
        <p className="muted">Live customer plan records, public pricing and payment history from the same database used for website signup and checkout.</p>
        <small className="muted">Rows displayed here reflect the most recently loaded platform data (up to 300 subscription and payment records per view). They are not Google Analytics visitor counts.</small>
      </div>
      <div className="website-subscription-links">
        <a className="secondary-button" href="/pricing" target="_blank" rel="noopener noreferrer">↗ Public pricing</a>
        <button className="primary-button" type="button" onClick={onPayments}>View payments</button>
      </div>
    </div>

    <div className="website-subscription-stats" aria-label="Loaded subscription breakdown">
      <div className="panel"><span>Loaded subscriptions</span><strong>{known.length}</strong><small>{clientCount} client accounts loaded</small></div>
      <div className="panel"><span>Active</span><strong>{active}</strong><small>Current valid paid terms</small></div>
      <div className="panel"><span>Trialing</span><strong>{trial}</strong><small>Current free trials</small></div>
      <div className="panel"><span>Needs attention</span><strong>{attention}</strong><small>Expired, paused or canceled</small></div>
    </div>

    <div className="panel website-subscription-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Website plan catalog</p><h2>Plans shown on RelayWA.com</h2></div>
        <div className="website-subscription-switch">
          <button type="button" aria-pressed={!annual} className={!annual?'selected':''} onClick={()=>setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} className={annual?'selected':''} onClick={()=>setAnnual(true)}>Yearly</button>
        </div>
      </div>
      {plans.length?<div className="website-subscription-plans">
        {plans.map(p=><article key={p.code}>
          <span className="eyebrow">{p.code}</span>
          <h3>{p.name}</h3>
          <strong>{cost(annual?p.annual_price_cents:p.monthly_price_cents,p.currency)}<small>/{annual?'year':'month'}</small></strong>
          <p>{p.max_sessions} WhatsApp {p.max_sessions===1?'number':'numbers'} · {p.max_api_keys} API keys</p>
          <small>{p.monthly_messages===null?'No monthly message cap':p.monthly_messages.toLocaleString()+' monthly messages'}</small>
        </article>)}
      </div>:<p className="muted">No active plans were returned from the billing catalog.</p>}
      <p className="muted">Plans and entitlements are read from the same subscription_plans records as the public website. Changes to pricing require the relevant catalog update; this page does not modify prices or charge customers.</p>
    </div>

    <div className="panel website-subscription-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Real subscriber accounts</p><h2>Website customer subscriptions</h2></div>
        <span className="muted">{matching.length} displayed</span>
      </div>
      <div className="website-subscription-controls">
        <input type="search" aria-label="Search website subscribers" placeholder="Search client, plan or provider"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <select aria-label="Filter website subscription status" value={status}
          onChange={e=>setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option><option value="active">Active</option>
          <option value="trialing">Trialing</option><option value="attention">Needs attention</option>
        </select>
      </div>
      <div className="website-subscription-table-wrap">
        <table className="website-subscription-table">
          <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Provider</th><th>Valid through</th><th>Manage</th></tr></thead>
          <tbody>{matching.map(item=><tr key={item.organization_id}>
            <td><strong>{item.organization_name}</strong></td>
            <td>{item.plan_code}</td>
            <td><span className={'website-subscription-status '+(item.effective_status??item.status)}>{(item.effective_status??item.status).replaceAll('_',' ')}</span></td>
            <td>{item.provider||'Trial / platform'}</td>
            <td>{readable(item.current_period_end)}</td>
            <td><button type="button" className="mini-button" onClick={()=>onManage(item.organization_id)}>Manage</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!matching.length&&<p className="muted">No website customer subscriptions match the current filters.</p>}
    </div>

    <div className="panel website-subscription-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Checkout and renewals</p><h2>Recent website payments</h2></div>
        <button className="secondary-button" onClick={onPayments} type="button">All payment records</button>
      </div>
      <div className="website-subscription-table-wrap">
        <table className="website-subscription-table">
          <thead><tr><th>Client</th><th>Plan</th><th>Payment method</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{payments.slice(0,12).map(p=><tr key={p.id}>
            <td>{p.organization_name}</td><td>{p.plan_code}</td><td>{p.provider}</td>
            <td>{cost(p.amount_cents,p.currency)}</td><td>{p.status}</td><td>{readable(p.created_at)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!payments.length&&<p className="muted">No website payment activity was returned.</p>}
      <p className="muted">Paid records in the loaded history: {paid.length}. Use the Payments section for manual approvals; subscription changes here never trigger a charge.</p>
    </div>
  </section>;
}
