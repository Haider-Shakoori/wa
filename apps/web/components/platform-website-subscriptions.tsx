'use client';

import { useState } from 'react';
import { api } from '../lib/api';
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

export function PlatformWebsiteSubscriptions({plans,payments,token,canEdit,canDelete,onUpdated,onDeleted,onPayments}:{
  plans:ClientPlan[];
  payments:Payment[];
  token:string;
  canEdit:boolean;
  canDelete:boolean;
  onUpdated:(savedPlan:ClientPlan)=>Promise<void>;
  onDeleted:(code:string)=>Promise<void>;
  onPayments:()=>void;
}) {
  const [annual,setAnnual]=useState(false);
  const [editingCode,setEditingCode]=useState<string|null>(null);
  const [actionBusy,setActionBusy]=useState<string|null>(null);
  const [actionError,setActionError]=useState('');
  const [actionNotice,setActionNotice]=useState('');
  const current=plans.find(p=>p.code===editingCode)??null;
  const isPurchasable=(plan:ClientPlan)=>plan.available_for_purchase!==false&&plan.available_for_purchase!==0;

  async function togglePurchases(plan:ClientPlan) {
    if(actionBusy||!canEdit||plan.code==='trial'||plan.code==='enterprise_b2b')return;
    const next=!isPurchasable(plan);
    const reason=window.prompt((next?'Enable':'Disable')+' new purchases for '+plan.name+'? Enter a reason (8+ characters):');
    if(reason===null)return;
    if(reason.trim().length<8){setActionError('Enter an audit reason of at least 8 characters.');return;}
    if(!window.confirm((next?'Enable':'Disable')+' new purchases for '+plan.name+'? Existing subscribers retain access.'))return;
    setActionBusy(plan.code);setActionError('');setActionNotice('');
    try {
      const saved=await api<ClientPlan>('/platform/website-plans/'+encodeURIComponent(plan.code)+'/availability',token,{
        method:'PATCH',body:JSON.stringify({availableForPurchase:next,reason:reason.trim()}),
      });
      await onUpdated(saved);
      setActionNotice(next?plan.name+' is available for new purchases.':plan.name+' is hidden from new purchases.');
    } catch(error){setActionError(error instanceof Error?error.message:'Could not update plan availability.');}
    finally{setActionBusy(null);}
  }

  async function deletePlan(plan:ClientPlan) {
    if(actionBusy||!canDelete||plan.code==='trial'||plan.code==='enterprise_b2b')return;
    const code=window.prompt('Type the exact plan code '+plan.code+' to permanently delete this unused plan:');
    if(code===null)return;
    if(code.trim()!==plan.code){setActionError('Plan code did not match. No changes made.');return;}
    const reason=window.prompt('Reason for deleting '+plan.name+' (8+ characters):');
    if(reason===null)return;
    if(reason.trim().length<8){setActionError('Enter an audit reason of at least 8 characters.');return;}
    if(!window.confirm('Permanently delete '+plan.name+'? It cannot be restored without a backup. Plans with subscriber or payment references cannot be deleted.'))return;
    setActionBusy(plan.code);setActionError('');setActionNotice('');
    try{
      await api('/platform/website-plans/'+encodeURIComponent(plan.code),token,{
        method:'DELETE',body:JSON.stringify({reason:reason.trim()}),
      });
      await onDeleted(plan.code);
      setActionNotice('Plan '+plan.name+' was deleted.');
      if(editingCode===plan.code)setEditingCode(null);
    }catch(error){setActionError(error instanceof Error?error.message:'Could not delete plan. Disable purchases instead.');}
    finally{setActionBusy(null);}
  }


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
      {actionError&&<p role="alert" className="alert">{actionError}</p>}
      {actionNotice&&<p role="status" className="muted">{actionNotice}</p>}
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
          {!isPurchasable(plan)&&<small role="status">Unavailable for new purchases</small>}
          {canEdit&&plan.code!=='trial'&&plan.code!=='enterprise_b2b'&&
            <button type="button" className="secondary-button" disabled={actionBusy!==null}
              onClick={()=>void togglePurchases(plan)}>{actionBusy===plan.code?'Saving…':isPurchasable(plan)?'Disable new purchases':'Enable new purchases'}</button>}
          {canDelete&&plan.code!=='trial'&&plan.code!=='enterprise_b2b'&&
            <button type="button" className="secondary-button" disabled={actionBusy!==null}
              onClick={()=>void deletePlan(plan)}>Delete unused plan</button>}
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
