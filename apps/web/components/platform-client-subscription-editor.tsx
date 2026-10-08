'use client';

import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export type ClientPlan = {
  code:string;name:string;max_sessions:number;daily_messages:number|null;
  monthly_messages:number|null;max_api_keys:number;
};
export type ClientSubscription = {
  organization_id:string;organization_name:string;plan_code:string;status:string;
  effective_status?:string;current_period_end:string;current_period_start:string;
  trial_ends_at:string|null;provider:string|null;
};

export function PlatformClientSubscriptionEditor({
  client,subscription,plans,token,canEdit,onClose,onUpdated,
}:{
  client:{id:string;name:string;slug:string};
  subscription:ClientSubscription|undefined;
  plans:ClientPlan[];
  token:string;canEdit:boolean;onClose:()=>void;onUpdated:()=>Promise<void>;
}) {
  const [planCode,setPlanCode]=useState(subscription?.plan_code??plans.find(p=>p.code==='trial')?.code??plans[0]?.code??'');
  const [status,setStatus]=useState(subscription?.status??'trialing');
  const [termAction,setTermAction]=useState<'keep'|'extend'|'date'>(subscription?'keep':'extend');
  const [extendDays,setExtendDays]=useState(30);
  const [periodEndDate,setPeriodEndDate]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const plan=plans.find(p=>p.code===planCode);
  const expired=subscription?new Date(subscription.current_period_end).getTime()<=Date.now():false;
  const endsAt=subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleString(): 'Not assigned';

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!canEdit||busy)return;
    if(reason.trim().length<8){setError('Enter a reason of at least eight characters.');return;}
    if(!planCode){setError('Choose an active plan.');return;}
    if(termAction==='date' && !periodEndDate){setError('Choose a valid expiration date.');return;}
    if(!window.confirm('Apply '+planCode+' / '+status+' subscription to '+client.name+
      '? This will affect new messaging, session quotas and queued outbound dispatch.'))return;
    setBusy(true);setError('');
    try {
      await api('/platform/subscriptions/'+encodeURIComponent(client.id),token,{
        method:'PATCH',
        body:JSON.stringify({
          planCode,status,reason:reason.trim(),
          ...(termAction==='extend'?{extendDays}:{}),
          ...(termAction==='date'?{periodEndDate}:{}),
        }),
      });
      await onUpdated();
      onClose();
    }catch(err){setError(err instanceof Error?err.message:'Subscription could not be saved');}
    finally{setBusy(false);}
  }

  return <section className="panel platform-client-subscription-editor"
    aria-label={'Manage subscription for '+client.name}>
    <div className="panel-head">
      <div><p className="eyebrow">Client subscription management</p>
        <h2>{client.name}</h2>
        <p className="muted">{client.slug} · {subscription?'Current plan: '+subscription.plan_code:'No subscription assigned'}
          {' · '}Expiry: {endsAt}
        </p>
      </div>
      <button className="secondary-button" type="button" onClick={onClose}>Close editor</button>
    </div>
    {subscription?.provider && !['internal','manual','platform'].includes(subscription.provider) &&
      <p className="platform-subscription-notice">Provider: {subscription.provider}.
        Future payment events or renewals may update this subscription again. Manual changes do not charge the client.</p>}
    {expired&&<p className="platform-subscription-notice">
      The stored status is {subscription?.status}, but its billing period expired. To restore access, choose
      Active and extend the term or set a future end date.
    </p>}
    {!canEdit ? <p className="muted">Only Super Admins and Billing Admins may change client subscriptions.</p>:
      <form className="platform-client-subscription-form" onSubmit={e=>void submit(e)}>
        <label>Subscription plan
          <select value={planCode} required onChange={e=>setPlanCode(e.target.value)}>
            {plans.map(item=><option value={item.code} key={item.code}>{item.name} ({item.code})</option>)}
          </select>
        </label>
        <label>Subscription status
          <select value={status} onChange={e=>setStatus(e.target.value)}>
            {['trialing','active','past_due','paused','canceled','expired'].map(item=>
              <option key={item} value={item}>{item.replaceAll('_',' ')}</option>)}
          </select>
        </label>
        <label>Validity
          <select value={termAction} onChange={e=>setTermAction(e.target.value as 'keep'|'extend'|'date')}>
            {subscription&&<option value="keep">Keep current end date (renew expired terms automatically)</option>}
            <option value="extend">Extend from current expiry or today</option>
            <option value="date">Set exact end date (UTC, inclusive)</option>
          </select>
        </label>
        {termAction==='extend'&&<label>Extend validity
          <select value={extendDays} onChange={e=>setExtendDays(Number(e.target.value))}>
            {[7,14,30,90,180,365,730].map(days=><option key={days} value={days}>+{days} days</option>)}
          </select>
        </label>}
        {termAction==='date'&&<label>Subscription valid through
          <input type="date" required value={periodEndDate}
            onChange={e=>setPeriodEndDate(e.target.value)}
            min={new Date().toISOString().slice(0,10)}/>
        </label>}
        {plan&&<div className="platform-subscription-plan-limits">
          <strong>Plan entitlements</strong>
          <span>{plan.max_sessions} WhatsApp sessions</span>
          <span>{plan.max_api_keys} API keys</span>
          <span>{plan.monthly_messages==null?'Unlimited':plan.monthly_messages.toLocaleString()} messages / month</span>
          <span>{plan.daily_messages==null?'Unlimited':plan.daily_messages.toLocaleString()} messages / day</span>
        </div>}
        <label className="platform-subscription-reason">Reason for change
          <textarea required minLength={8} maxLength={500} rows={2}
            placeholder="Example: Payment received for one-year subscription"
            value={reason} onChange={e=>setReason(e.target.value)}/>
        </label>
        <p className="muted">The update is audited and takes effect for client API quotas and new outbound dispatch.
          Connected WhatsApp sessions remain linked. No payment is collected by this action.</p>
        {error&&<p role="alert" className="alert">{error}</p>}
        <div className="platform-subscription-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy||plans.length===0}>
            {busy?'Applying…':subscription?'Save subscription':'Assign subscription'}
          </button>
        </div>
      </form>}
  </section>;
}
