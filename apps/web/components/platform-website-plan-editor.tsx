'use client';

import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { ClientPlan } from './platform-client-subscription-editor';

const dollars=(cents:number)=>((Number(cents)||0)/100).toFixed(2);

export function PlatformWebsitePlanEditor({plan,token,onClose,onUpdated}:{
  plan:ClientPlan|null;
  token:string;
  onClose:()=>void;
  onUpdated:()=>Promise<void>;
}) {
  const [code,setCode]=useState(plan?.code??'');
  const [name,setName]=useState(plan?.name??'');
  const [maxSessions,setMaxSessions]=useState(plan?.max_sessions??1);
  const [maxApiKeys,setMaxApiKeys]=useState(plan?.max_api_keys??1);
  const [dailyMessages,setDailyMessages]=useState(plan?.daily_messages?.toString()??'');
  const [monthlyMessages,setMonthlyMessages]=useState(plan?.monthly_messages?.toString()??'');
  const [monthlyPrice,setMonthlyPrice]=useState(dollars(plan?.monthly_price_cents??0));
  const [annualPrice,setAnnualPrice]=useState(dollars(plan?.annual_price_cents??0));
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(busy)return;
    const codeSafe=code.trim().toLowerCase();
    const monthlyCents=Math.round(Number(monthlyPrice)*100);
    const annualCents=Math.round(Number(annualPrice)*100);
    if(!/^[a-z][a-z0-9_-]{1,39}$/.test(codeSafe)){setError('Plan code must contain 2–40 lowercase letters, digits, hyphens or underscores.');return;}
    if(!Number.isSafeInteger(monthlyCents)||!Number.isSafeInteger(annualCents)||monthlyCents<=0||annualCents<=0){setError('Both monthly and annual prices must be greater than zero.');return;}
    if(reason.trim().length<8){setError('Enter an audit reason of at least 8 characters.');return;}
    if(!window.confirm((plan?'Update':'Create')+' public website plan '+codeSafe+'? Pricing changes affect future checkouts; entitlement changes can affect current subscribers. Existing payments will not be charged again.'))return;
    setBusy(true);setError('');
    try {
      await api(plan?'/platform/website-plans/'+encodeURIComponent(plan.code):'/platform/website-plans',
        token,{
          method:plan?'PATCH':'POST',
          body:JSON.stringify({
            code:codeSafe,name:name.trim(),maxSessions,maxApiKeys,
            dailyMessages:dailyMessages.trim()===''?null:Number(dailyMessages),
            monthlyMessages:monthlyMessages.trim()===''?null:Number(monthlyMessages),
            monthlyPriceCents:monthlyCents,annualPriceCents:annualCents,currency:'USD',
            reason:reason.trim(),
          }),
        });
      await onUpdated();
      onClose();
    } catch(e) {setError(e instanceof Error?e.message:'Plan could not be saved.');}
    finally {setBusy(false);}
  }

  return <section className="panel website-plan-editor" aria-label={plan?'Edit website plan '+plan.name:'Add website subscription plan'}>
    <div className="panel-head">
      <div><p className="eyebrow">Website subscription catalog</p>
        <h3>{plan?'Edit plan: '+plan.name:'Add another website plan'}</h3>
        <p className="muted">Prices are in USD. Limits update existing subscribers; price edits apply to future checkouts and do not collect payments.</p>
      </div>
      <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Close editor</button>
    </div>
    <form onSubmit={e=>void submit(e)} className="website-plan-form">
      <label>Plan code
        <input required disabled={!!plan} minLength={2} maxLength={40} value={code}
          placeholder="business" onChange={e=>setCode(e.target.value.toLowerCase())}/>
      </label>
      <label>Display name
        <input required maxLength={100} minLength={2} value={name}
          placeholder="Business" onChange={e=>setName(e.target.value)}/>
      </label>
      <label>Monthly price (USD)
        <input type="number" min="0.01" step="0.01" required value={monthlyPrice}
          onChange={e=>setMonthlyPrice(e.target.value)}/>
      </label>
      <label>Annual price (USD)
        <input type="number" min="0.01" step="0.01" required value={annualPrice}
          onChange={e=>setAnnualPrice(e.target.value)}/>
      </label>
      <label>Maximum WhatsApp sessions
        <input type="number" min={1} max={100000} step={1} required value={maxSessions}
          onChange={e=>setMaxSessions(Number(e.target.value))}/>
      </label>
      <label>Maximum API keys
        <input type="number" min={1} max={100000} step={1} required value={maxApiKeys}
          onChange={e=>setMaxApiKeys(Number(e.target.value))}/>
      </label>
      <label>Daily message limit <small>(blank = unlimited)</small>
        <input type="number" min={1} max={100000000} step={1} value={dailyMessages}
          onChange={e=>setDailyMessages(e.target.value)}/>
      </label>
      <label>Monthly message limit <small>(blank = unlimited)</small>
        <input type="number" min={1} max={100000000} step={1} value={monthlyMessages}
          onChange={e=>setMonthlyMessages(e.target.value)}/>
      </label>
      <label className="website-plan-wide">Audit reason
        <textarea value={reason} rows={2} minLength={8} maxLength={500} required
          placeholder="Example: Updated public website pricing for the new tier"
          onChange={e=>setReason(e.target.value)}/>
      </label>
      {error&&<p role="alert" className="alert website-plan-wide">{error}</p>}
      <div className="website-plan-actions website-plan-wide">
        <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="primary-button" disabled={busy||reason.trim().length<8}>
          {busy?'Saving…':plan?'Save website plan':'Create website plan'}
        </button>
      </div>
    </form>
  </section>;
}
