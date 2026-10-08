'use client';

import { useState } from 'react';
import type { ClientPlan } from './platform-client-subscription-editor';
import { PlatformWebsitePlanEditor } from './platform-website-plan-editor';

type Payment = {
  id:string;
  organization_name:string;
  provider:string;
  plan_code:string;
  billing_interval:string;
  amount_cents:number;
  currency:string;
  status:string;
  created_at:string;
};
const readable=(value:string)=>value?new Date(value).toLocaleDateString():'—';
const money=(cents:number,currency='USD')=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:currency||'USD',
}).format((Number(cents)||0)/100);

export function PlatformWebsiteSubscriptions({plans,payments,token,canEdit,onUpdated,onPayments}:{
  plans:ClientPlan[];
  payments:Payment[];
  token:string;
  canEdit:boolean;
  onUpdated:()=>Promise<void>;
  onPayments:()=>void;
}) {
  const [annual,setAnnual]=useState(false);
  const [editingCode,setEditingCode]=useState<string|null>(null);
  const current=plans.find(p=>p.code===editingCode)??null;

  return <section className="website-subscriptions" aria-label="Website subscriptions">
    <div className="panel website-subscriptions-head">
      <div>
        <p className="eyebrow">RelayWA.com · Pricing and billing</p>
        <h2>Website subscription plans</h2>
        <p className="muted">These are the actual plans offered through RelayWA.com pricing, signup and checkout. Manage customer accounts and their individual expiry dates under Platform → Subscriptions instead.</p>
      </div>
      <div className="website-subscription-links">
        <a className="secondary-button" href="/pricing" target="_blank" rel="noopener noreferrer">↗ Public pricing</a>
        {canEdit&&<button type="button" className="primary-button"
          onClick={()=>setEditingCode('new')}>+ Add website plan</button>}
      </div>
    </div>

    {editingCode!==null && canEdit &&
      <PlatformWebsitePlanEditor
        key={editingCode}
        plan={current}
        token={token}
        onClose={()=>setEditingCode(null)}
        onUpdated={onUpdated}/>}

    <div className="panel website-subscription-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Website plan catalog</p><h2>Live public subscription plans</h2></div>
        <div className="website-subscription-switch" aria-label="Website billing period">
          <button type="button" aria-pressed={!annual} className={!annual?'selected':''}
            onClick={()=>setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} className={annual?'selected':''}
            onClick={()=>setAnnual(true)}>Yearly</button>
        </div>
      </div>
      {plans.length?<div className="website-subscription-plans">
        {plans.map(plan=><article key={plan.code}>
          <span className="eyebrow">{plan.code}</span>
          <h3>{plan.name}</h3>
          <strong>{money(annual?plan.annual_price_cents:plan.monthly_price_cents,plan.currency)}
            <small>/{annual?'year':'month'}</small></strong>
          <p>{plan.max_sessions} WhatsApp {plan.max_sessions===1?'session':'sessions'} · {plan.max_api_keys} API keys</p>
          <small>{plan.daily_messages===null?'Unlimited daily messages':plan.daily_messages.toLocaleString()+' daily messages'}</small>
          <small>{plan.monthly_messages===null?'Unlimited monthly messages':plan.monthly_messages.toLocaleString()+' monthly messages'}</small>
          {canEdit&&plan.code!=='trial'&&
            <button type="button" className="secondary-button website-plan-edit-btn"
              onClick={()=>setEditingCode(plan.code)}>Edit plan</button>}
          {plan.code==='trial'&&<small>Built-in trial plan · restricted</small>}
        </article>)}
      </div>:<p className="muted">No website plans are currently configured.</p>}
      <p className="muted">Updates are immediately reflected in the website catalog after publishing. Editing prices does not charge existing customers or rewrite earlier payments. Updated limits apply to users of the plan.</p>
    </div>

    <div className="panel website-subscription-panel">
      <div className="panel-head">
        <div><p className="eyebrow">Checkout and renewals</p><h2>Recent website payments</h2></div>
        <button className="secondary-button" type="button" onClick={onPayments}>All payment records</button>
      </div>
      <div className="website-subscription-table-wrap">
        <table className="website-subscription-table">
          <thead><tr><th>Customer</th><th>Plan</th><th>Payment method</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{payments.slice(0,12).map(payment=><tr key={payment.id}>
            <td>{payment.organization_name}</td><td>{payment.plan_code} / {payment.billing_interval}</td>
            <td>{payment.provider}</td><td>{money(payment.amount_cents,payment.currency)}</td>
            <td>{payment.status}</td><td>{readable(payment.created_at)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!payments.length&&<p className="muted">No payments have been recorded yet.</p>}
      <p className="muted">Stripe payments update the subscription term after confirmed webhook payment. Manual payments update the term only after an authorized administrator approves the payment.</p>
    </div>
  </section>;
}
