'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

type OnboardingState = {
  organization:any;
  step:'plan'|'payment'|'workspace'|'connect'|'api_key'|'test'|'webhook'|'complete';
  completed:boolean;
  subscription:any|null;
  plans:any[];
  providers:any[];
  sessions:any[];
  progress:{
    plan:boolean;
    workspace:boolean;
    connectedSession:boolean;
    apiKey:boolean;
    testMessage:boolean;
    webhook:boolean;
  };
};

const steps = [
  ['plan','Choose plan'],
  ['workspace','Workspace'],
  ['connect','Connect WhatsApp'],
  ['api_key','API key'],
  ['test','Test message'],
  ['webhook','Webhook'],
] as const;

export default function OnboardingPage() {
  const router=useRouter();
  const [token,setToken]=useState('');
  const [state,setState]=useState<OnboardingState|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [billingInterval,setBillingInterval]=useState<'monthly'|'annual'>('monthly');
  const [workspaceName,setWorkspaceName]=useState('');
  const [sessionName,setSessionName]=useState('Primary WhatsApp');
  const [qr,setQr]=useState<any>(null);
  const [createdKey,setCreatedKey]=useState('');
  const [recipient,setRecipient]=useState('');
  const [message,setMessage]=useState('Hello from RelayWA — your WhatsApp API is working.');
  const [webhookUrl,setWebhookUrl]=useState('');
  const [manualReference,setManualReference]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const current=localStorage.getItem('relaywa_access_token') ?? '';
    if (!current) {
      router.replace('/login');
      return;
    }
    setToken(current);
  },[router]);

  function accountLogout() {
    localStorage.removeItem('relaywa_access_token');
    setToken('');
    router.replace('/login');
    router.refresh();
  }

  async function load(current=token) {
    if (!current) return;
    setError('');
    try {
      const result=await api<OnboardingState>('/v1/onboarding/state',current);
      setState(result);
      setWorkspaceName((value)=>value || result.organization?.name || '');
      if (result.completed) router.replace('/dashboard');
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Unable to load onboarding');
    }
  }

  useEffect(()=>{ void load(); },[token]);

  const activeIndex=useMemo(()=>{
    if (!state) return 0;
    const step=state.step==='payment'?'plan':state.step;
    const index=steps.findIndex(([key])=>key===step);
    return index<0?steps.length:index;
  },[state]);

  async function run(action:()=>Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch(err) { setError(err instanceof Error ? err.message : 'Unable to continue'); }
    finally { setBusy(false); }
  }

  async function selectPlan(plan:any) {
    await run(async()=>{
      await api('/v1/onboarding/plan',token,{
        method:'POST',
        body:JSON.stringify({planCode:plan.code,billingInterval}),
      });
      await load();
    });
  }

  async function startStripe() {
    if (!state?.organization?.selected_plan_code) return;
    await run(async()=>{
      const result=await api<any>('/v1/billing/checkout/stripe',token,{
        method:'POST',
        body:JSON.stringify({
          planCode:state.organization.selected_plan_code,
          billingInterval:state.organization.selected_billing_interval || billingInterval,
        }),
      });
      window.location.href=result.checkoutUrl;
    });
  }

  async function submitManual(event:FormEvent) {
    event.preventDefault();
    if (!state?.organization?.selected_plan_code) return;
    await run(async()=>{
      await api('/v1/billing/manual',token,{
        method:'POST',
        body:JSON.stringify({
          planCode:state.organization.selected_plan_code,
          billingInterval:state.organization.selected_billing_interval || billingInterval,
          reference:manualReference,
        }),
      });
      setNotice('Payment request submitted. A platform administrator must approve it before onboarding can continue.');
    });
  }

  async function checkPayment() {
    await run(async()=>{
      await api('/v1/onboarding/continue',token,{method:'POST',body:'{}'});
      await load();
    });
  }

  async function saveWorkspace(event:FormEvent) {
    event.preventDefault();
    await run(async()=>{
      await api('/v1/onboarding/workspace',token,{
        method:'PATCH',
        body:JSON.stringify({name:workspaceName}),
      });
      await load();
    });
  }

  async function createSession() {
    await run(async()=>{
      const session=await api<any>('/v1/sessions',token,{
        method:'POST',
        body:JSON.stringify({name:sessionName}),
      });
      await load();
    });
  }

  async function connectSession(sessionId:string) {
    setQr(null);
    await run(async()=>{
      await api('/v1/sessions/' + sessionId + '/connect',token,{method:'POST'});
      for(let attempt=0;attempt<30;attempt+=1){
        await wait(700);
        const current=await api<any>('/v1/sessions/' + sessionId,token);
        if(current.status==='connected'){
          setNotice('WhatsApp connected: ' + (current.phone_number ? '+' + current.phone_number : current.display_name || sessionName));
          await api('/v1/onboarding/continue',token,{method:'POST',body:'{}'});
          await load();
          return;
        }
        const qrValue=await api<any>('/v1/sessions/' + sessionId + '/qr',token);
        if(qrValue.available && qrValue.dataUrl) setQr(qrValue);
      }
      throw new Error('QR is ready but the connection has not completed yet. Keep this page open and scan again if needed.');
    });
  }

  async function createKey() {
    const session=state?.sessions.find((item:any)=>item.status==='connected') || state?.sessions[0];
    if(!session) return;
    await run(async()=>{
      const result=await api<any>('/v1/api-keys',token,{
        method:'POST',
        body:JSON.stringify({
          name:'Onboarding API key',
          tokenType:'session',
          sessionId:session.id,
          scopes:['sessions.read','messages.read','messages.send','webhooks.read'],
        }),
      });
      setCreatedKey(result.token);
      await load();
    });
  }

  async function continueExistingKey() {
    await run(async()=>{
      await api('/v1/onboarding/continue',token,{method:'POST',body:'{}'});
      await load();
    });
  }

  async function sendTest(event:FormEvent) {
    event.preventDefault();
    const session=state?.sessions.find((item:any)=>item.status==='connected');
    if(!session) return;
    await run(async()=>{
      await api('/v1/sessions/' + session.id + '/messages/text',token,{
        method:'POST',
        body:JSON.stringify({
          to:recipient,
          text:message,
          clientMessageId:'onboarding-' + Date.now(),
        }),
      });
      await api('/v1/onboarding/continue',token,{method:'POST',body:'{}'});
      await load();
    });
  }

  async function createWebhook(event:FormEvent) {
    event.preventDefault();
    await run(async()=>{
      await api('/v1/webhooks',token,{
        method:'POST',
        body:JSON.stringify({
          name:'Primary webhook',
          url:webhookUrl,
          eventTypes:['message.received','message.status','session.status'],
        }),
      });
      await api('/v1/onboarding/continue',token,{method:'POST',body:'{}'});
      await load();
    });
  }

  async function skipWebhook() {
    await run(async()=>{
      const result=await api<OnboardingState>('/v1/onboarding/continue',token,{
        method:'POST',
        body:JSON.stringify({skipWebhook:true}),
      });
      if(result.completed) router.replace('/dashboard');
      else setState(result);
    });
  }

  if(!state) return <main className="onboarding-shell"><div className="onboarding-loading">Preparing your RelayWA workspace…</div></main>;

  const stripe=state.providers.find((provider:any)=>provider.provider==='stripe' && provider.enabled);
  const manual=state.providers.find((provider:any)=>provider.provider==='manual' && provider.enabled);

  return <main className="onboarding-shell">
    <aside className="onboarding-sidebar">
      <div className="brand"><div className="brand-mark">rW</div><div><strong>RelayWA</strong><span>Setup</span></div></div>
      <div className="onboarding-progress">
        {steps.map(([key,label],index)=><div key={key} className={index<activeIndex?'wizard-step complete':index===activeIndex?'wizard-step active':'wizard-step'}>
          <span>{index<activeIndex?'✓':index+1}</span>
          <div><strong>{label}</strong><small>{index<activeIndex?'Completed':index===activeIndex?'In progress':'Up next'}</small></div>
        </div>)}
      </div>
      <div className="onboarding-help"><span>Need help?</span><p>Complete each step once. You can safely leave and return later.</p></div>
    </aside>

    <section className="onboarding-main">
      <header className="onboarding-header">
        <div><p className="eyebrow">Welcome to RelayWA</p><h1>Connect WhatsApp to your software.</h1></div>
        <div className="onboarding-header-actions"><span className="setup-badge">Step {Math.min(activeIndex+1,6)} of 6</span><button className="danger-button account-logout" onClick={accountLogout}>Sign out</button></div>
      </header>

      {error && <div className="alert">{error}</div>}
      {notice && <div className="success-alert">{notice}</div>}

      {state.step==='plan' && <section className="onboarding-panel">
        <div className="onboarding-title"><p className="eyebrow">Choose your plan</p><h2>Start with the capacity you need.</h2><p>You can upgrade later. Trial requires no payment.</p></div>
        <div className="billing-toggle"><button className={billingInterval==='monthly'?'active':''} onClick={()=>setBillingInterval('monthly')}>Monthly</button><button className={billingInterval==='annual'?'active':''} onClick={()=>setBillingInterval('annual')}>Annual <span>Save</span></button></div>
        <div className="plan-grid">
          {state.plans.map((plan:any)=><article key={plan.code} className={plan.code==='growth'?'plan-card featured':'plan-card'}>
            {plan.code==='growth' && <span className="popular-badge">Recommended</span>}
            <p className="eyebrow">{plan.name}</p>
            <h3>{plan.code==='trial'?'Free':money(billingInterval==='annual'?plan.annual_price_cents:plan.monthly_price_cents,plan.currency)}</h3>
            <small>{plan.code==='trial'?'7-day trial':billingInterval==='annual'?'per year':'per month'}</small>
            <ul><li>{plan.max_sessions} WhatsApp session{plan.max_sessions===1?'':'s'}</li><li>{Number(plan.monthly_messages).toLocaleString()} messages / month</li><li>{plan.max_api_keys} API keys</li><li>API + webhooks</li></ul>
            <button className={plan.code==='growth'?'primary-button wide':'secondary-button wide'} disabled={busy} onClick={()=>void selectPlan(plan)}>{plan.code==='trial'?'Start free trial':'Choose ' + plan.name}</button>
          </article>)}
        </div>
      </section>}

      {state.step==='payment' && <section className="onboarding-panel narrow">
        <div className="onboarding-title"><p className="eyebrow">Activate your plan</p><h2>Complete payment to continue.</h2><p>{state.organization.selected_plan_code} · {state.organization.selected_billing_interval}</p></div>
        <div className="payment-options">
          {stripe && <button className="primary-button wide" onClick={()=>void startStripe()} disabled={busy}>Pay securely with Stripe</button>}
          {manual && <form className="onboarding-form" onSubmit={submitManual}><label>Payment reference<input value={manualReference} onChange={(e)=>setManualReference(e.target.value)} placeholder="Transfer/reference number" required minLength={2}/></label><button className="secondary-button wide" disabled={busy}>Submit manual payment</button></form>}
          {!stripe && !manual && <div className="alert">No payment provider is currently enabled. Choose Trial or contact RelayWA support.</div>}
        </div>
        <button className="text-button setup-check" onClick={()=>void checkPayment()}>I completed payment — check status →</button>
      </section>}

      {state.step==='workspace' && <section className="onboarding-panel narrow">
        <div className="onboarding-title"><p className="eyebrow">Your workspace</p><h2>Name the account your team will use.</h2><p>This appears across billing, sessions and platform administration.</p></div>
        <form className="onboarding-form" onSubmit={saveWorkspace}><label>Workspace name<input value={workspaceName} onChange={(e)=>setWorkspaceName(e.target.value)} placeholder="Acme Ltd" required minLength={2}/></label><button className="primary-button" disabled={busy}>Continue</button></form>
      </section>}

      {state.step==='connect' && <section className="onboarding-panel">
        <div className="onboarding-title"><p className="eyebrow">Connect WhatsApp</p><h2>Link the number your application will send from.</h2><p>Open WhatsApp → Linked devices → Link a device, then scan the QR.</p></div>
        {!state.sessions.length ? <div className="connect-setup"><label>Session name<input value={sessionName} onChange={(e)=>setSessionName(e.target.value)}/></label><button className="primary-button" onClick={()=>void createSession()} disabled={busy}>Create WhatsApp session</button></div> :
        <div className="connect-grid">{state.sessions.map((session:any)=><article className="connect-session-card" key={session.id}><div><strong>{session.name}</strong><span>{session.phone_number?'+' + session.phone_number:session.status.replace('_',' ')}</span></div>{session.status==='connected'?<button className="primary-button" onClick={()=>void api('/v1/onboarding/continue',token,{method:'POST',body:'{}'}).then(()=>load())}>Use this number</button>:<button className="secondary-button" onClick={()=>void connectSession(session.id)} disabled={busy}>Connect / QR</button>}</article>)}</div>}
        {qr?.dataUrl && <div className="onboarding-qr"><img src={qr.dataUrl} alt="WhatsApp QR"/><div><strong>Scan this QR with WhatsApp</strong><p>The page will advance automatically after the linked number is verified.</p></div></div>}
      </section>}

      {state.step==='api_key' && <section className="onboarding-panel narrow">
        <div className="onboarding-title"><p className="eyebrow">Developer access</p><h2>Create your first API key.</h2><p>We’ll bind it to your connected session with send/read permissions.</p></div>
        {!state.progress.apiKey && <button className="primary-button wide" onClick={()=>void createKey()} disabled={busy}>Generate API key</button>}
        {createdKey && <div className="token-reveal"><strong>Copy this key now</strong><p className="muted">The full value is shown only once.</p><code>{createdKey}</code><button className="secondary-button" onClick={()=>void navigator.clipboard.writeText(createdKey)}>Copy key</button></div>}
        {state.progress.apiKey && !createdKey && <><div className="success-alert">An active API key already exists for this workspace.</div><button className="primary-button wide" onClick={()=>void continueExistingKey()}>Continue</button></>}
        {createdKey && <button className="primary-button wide setup-next" onClick={()=>void continueExistingKey()}>I saved my key — continue</button>}
      </section>}

      {state.step==='test' && <section className="onboarding-panel narrow">
        <div className="onboarding-title"><p className="eyebrow">Live test</p><h2>Send your first WhatsApp message.</h2><p>Use E.164 international format with country code, digits only.</p></div>
        <form className="onboarding-form" onSubmit={sendTest}><label>Recipient number<input value={recipient} onChange={(e)=>setRecipient(e.target.value)} placeholder="e.g. 12025550123" required minLength={7}/></label><label>Message<textarea value={message} onChange={(e)=>setMessage(e.target.value)} required/></label><button className="primary-button" disabled={busy}>Send test & continue</button></form>
      </section>}

      {state.step==='webhook' && <section className="onboarding-panel narrow">
        <div className="onboarding-title"><p className="eyebrow">Real-time events</p><h2>Add a webhook endpoint.</h2><p>Receive inbound messages, delivery updates and session changes. You can also skip this and configure it later.</p></div>
        <form className="onboarding-form" onSubmit={createWebhook}><label>HTTPS webhook URL<input value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/relaywa" type="url" required/></label><button className="primary-button" disabled={busy}>Add webhook & finish</button></form>
        <button className="text-button setup-check" onClick={()=>void skipWebhook()} disabled={busy}>Skip for now →</button>
      </section>}
    </section>
  </main>;
}

function money(cents:number,currency:string){
  return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD',maximumFractionDigits:0}).format((Number(cents)||0)/100);
}

function wait(ms:number){ return new Promise((resolve)=>setTimeout(resolve,ms)); }
