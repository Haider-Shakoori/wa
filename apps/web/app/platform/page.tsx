'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { PlatformSupportBot } from '../../components/platform-support-bot';
import { Brand } from '../../components/relay-workspace';
import { FeatherIcon, type FeatherName } from '../../components/feather-icon';

const navigationGroups = [
  { label:'Operations', items:[['Overview','grid'],['Organizations','users'],['Sessions','layers'],['Messaging','send']] },
  { label:'Commercial', items:[['Subscriptions','credit'],['Payments','cart'],['Providers','shield']] },
  { label:'System', items:[['Infrastructure','chart'],['Authentication','lock'],['Diagnostics','bell']] },
] as const;

export default function PlatformPage() {
  const router=useRouter();
  const [token,setToken] = useState('');
  const [active,setActive] = useState('Overview');
  const [overview,setOverview] = useState<any>(null);
  const [tenants,setTenants] = useState<any[]>([]);
  const [sessions,setSessions] = useState<any[]>([]);
  const [subscriptions,setSubscriptions] = useState<any[]>([]);
  const [workers,setWorkers] = useState<any[]>([]);
  const [queues,setQueues] = useState<any>(null);
  const [errors,setErrors] = useState<any>(null);
  const [payments,setPayments] = useState<any[]>([]);
  const [providers,setProviders] = useState<any[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');
  const [menu,setMenu] = useState(false);
  const [adminName,setAdminName] = useState('');
  const [adminEmail,setAdminEmail] = useState('');
  const [googleEnabled,setGoogleEnabled] = useState(false);
  const [googleClientId,setGoogleClientId] = useState('');
  const [githubEnabled,setGithubEnabled] = useState(false);
  const [githubClientId,setGithubClientId] = useState('');
  const [githubSecretConfigured,setGithubSecretConfigured] = useState(false);
  const [messagingEngine,setMessagingEngine] = useState<'baileys'|'chromium'>('baileys');
  const [messagingSafety,setMessagingSafety] = useState<any>({
    enabled:true,
    minDelayMs:2500,
    maxDelayMs:5000,
    messagesPerMinute:20,
    messagesPerHour:300,
    burstLimit:5,
    burstWindowSeconds:10,
    duplicateWindowSeconds:60,
    retryBaseMs:5000,
    maxAttempts:5,
    maxQueueAgeSeconds:3600,
    failurePauseThreshold:5,
    failureWindowSeconds:300,
    autoPauseSeconds:900,
    hardMinimumDelayMs:1000,
  });

  useEffect(()=>{
    const current=localStorage.getItem('relaywa_access_token') ?? '';
    if (!current) {
      router.replace('/platform/login');
      return;
    }
    setToken(current);
    void api<any>('/auth/me',current).then((result)=>{
      setAdminName(String(result?.user?.name ?? ''));
      setAdminEmail(String(result?.user?.email ?? result?.auth?.email ?? ''));
    }).catch(()=>{});
  },[router]);

  function accountLogout() {
    localStorage.removeItem('relaywa_access_token');
    setToken('');
    router.replace('/platform/login');
    router.refresh();
  }

  async function refresh(current = token) {
    if (!current) return;
    setError('');
    try {
      const [o,t,s,subs,w,q,e,p,providerRows,authProviderRows,messagingEngineSettings,messagingSafetySettings] = await Promise.all([
        api('/platform/overview',current),
        api('/platform/tenants',current),
        api('/platform/sessions',current),
        api('/platform/subscriptions',current),
        api('/platform/workers',current),
        api('/platform/queues',current),
        api('/platform/errors',current),
        api('/platform/payments',current),
        api('/billing/providers',current),
        api('/platform/settings/auth-providers',current),
        api('/platform/settings/messaging-engine',current),
        api('/platform/settings/messaging-safety',current),
      ]);
      setOverview(o);
      setTenants(t as any[]);
      setSessions(s as any[]);
      setSubscriptions(subs as any[]);
      setWorkers(w as any[]);
      setQueues(q);
      setErrors(e);
      setPayments(p as any[]);
      setProviders(providerRows as any[]);
      const google=(authProviderRows as any[]).find((item)=>item.provider==='google');
      setGoogleEnabled(Boolean(google?.enabled));
      setGoogleClientId(String(google?.public_config?.clientId ?? ''));
      const github=(authProviderRows as any[]).find((item)=>item.provider==='github');
      setGithubEnabled(Boolean(github?.enabled));
      setGithubClientId(String(github?.public_config?.clientId ?? ''));
      setGithubSecretConfigured(Boolean(github?.public_config?.secretConfigured));
      setMessagingEngine((messagingEngineSettings as any)?.defaultEngine === 'chromium' ? 'chromium' : 'baileys');
      setMessagingSafety(messagingSafetySettings as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform operations');
    }
  }

  useEffect(()=>{ void refresh(); },[token]);

  async function approveManual(paymentId:string) {
    setError(''); setNotice('');
    try {
      await api('/billing/admin/manual/' + paymentId + '/approve', token, { method:'POST' });
      setNotice('Manual payment approved and the subscription was activated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve manual payment');
    }
  }

  async function sessionControl(sessionId:string, action:'connect'|'restart'|'logout') {
    setError(''); setNotice('');
    if (action === 'logout' && !window.confirm('Log this tenant WhatsApp session out? It will require a new QR scan.')) return;
    try {
      await api('/platform/sessions/' + sessionId + '/' + action,token,{method:'POST'});
      setNotice('Session ' + action + ' command queued.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to control session');
    }
  }

  async function resumeSessionMessaging(sessionId:string) {
    setError(''); setNotice('');
    try {
      await api('/platform/sessions/' + sessionId + '/messaging/resume',token,{method:'POST'});
      setNotice('Safety pause cleared. API messaging can resume for this session.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resume session messaging');
    }
  }

  async function changeSessionEngine(sessionId:string, engine:'baileys'|'chromium') {
    setError(''); setNotice('');
    try {
      const result:any = await api('/platform/sessions/' + sessionId + '/engine',token,{
        method:'PATCH',
        body:JSON.stringify({engine}),
      });
      setNotice(result?.message ?? 'Session engine preference updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update session engine');
    }
  }

  async function updateSubscription(organizationId:string, patch:any) {
    setError(''); setNotice('');
    try {
      await api('/platform/subscriptions/' + organizationId,token,{
        method:'PATCH',
        body:JSON.stringify(patch),
      });
      setNotice('Subscription updated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update subscription');
    }
  }

  async function saveGoogleAuth() {
    setError(''); setNotice('');
    try {
      await api('/platform/settings/auth-providers/google',token,{
        method:'PATCH',
        body:JSON.stringify({
          enabled:googleEnabled,
          clientId:googleClientId.trim(),
        }),
      });
      setNotice(googleEnabled ? 'Google sign-in is enabled.' : 'Google sign-in is disabled.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Google authentication settings');
    }
  }

  async function saveGithubAuth() {
    setError(''); setNotice('');
    try {
      await api('/platform/settings/auth-providers/github',token,{
        method:'PATCH',
        body:JSON.stringify({
          enabled:githubEnabled,
          clientId:githubClientId.trim(),
        }),
      });
      setNotice(githubEnabled ? 'GitHub sign-in is enabled.' : 'GitHub sign-in is disabled.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save GitHub authentication settings');
    }
  }

  async function saveMessagingEngine() {
    setError(''); setNotice('');
    try {
      await api('/platform/settings/messaging-engine',token,{
        method:'PATCH',
        body:JSON.stringify({engine:messagingEngine}),
      });
      setNotice('Default messaging engine changed to ' + (messagingEngine === 'chromium' ? 'Chromium / WhatsApp Web' : 'Baileys') + '. Existing sessions keep their current engine.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save messaging engine');
    }
  }

  async function saveMessagingSafety() {
    setError(''); setNotice('');
    try {
      if (Number(messagingSafety.maxDelayMs) < Number(messagingSafety.minDelayMs)) {
        setError('Maximum message delay must be greater than or equal to minimum delay.');
        return;
      }
      await api('/platform/settings/messaging-safety',token,{
        method:'PATCH',
        body:JSON.stringify({
          enabled:Boolean(messagingSafety.enabled),
          minDelayMs:Number(messagingSafety.minDelayMs),
          maxDelayMs:Number(messagingSafety.maxDelayMs),
          messagesPerMinute:Number(messagingSafety.messagesPerMinute),
          messagesPerHour:Number(messagingSafety.messagesPerHour),
          burstLimit:Number(messagingSafety.burstLimit),
          burstWindowSeconds:Number(messagingSafety.burstWindowSeconds),
          duplicateWindowSeconds:Number(messagingSafety.duplicateWindowSeconds),
          retryBaseMs:Number(messagingSafety.retryBaseMs),
          maxAttempts:Number(messagingSafety.maxAttempts),
          maxQueueAgeSeconds:Number(messagingSafety.maxQueueAgeSeconds),
          failurePauseThreshold:Number(messagingSafety.failurePauseThreshold),
          failureWindowSeconds:Number(messagingSafety.failureWindowSeconds),
          autoPauseSeconds:Number(messagingSafety.autoPauseSeconds),
        }),
      });
      setNotice('Messaging Safety Governor settings saved. Workers will pick them up automatically.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save messaging safety settings');
    }
  }

  function setSafetyNumber(key:string,value:string) {
    setMessagingSafety((current:any)=>({...current,[key]:Number(value)}));
  }

  async function toggleProvider(provider:any) {
    setError(''); setNotice('');
    try {
      await api('/billing/admin/providers',token,{
        method:'POST',
        body:JSON.stringify({
          provider:provider.provider,
          enabled:!provider.enabled,
          publicConfig:provider.public_config ?? {},
        }),
      });
      setNotice(provider.provider + ' was ' + (provider.enabled ? 'disabled' : 'enabled') + '.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update payment provider');
    }
  }

  const connected = overview?.sessions?.connected ?? 0;
  const failedMessages = overview?.messages?.failed ?? 0;
  const pendingManual = payments.filter((p)=>p.provider === 'manual' && p.status === 'pending').length;
  const healthyWorkers = workers.filter((w)=>new Date(w.lease_expires_at).getTime() > Date.now()).length;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTenants = normalizedQuery ? tenants.filter((item)=>[item.name,item.slug,item.plan_code,item.subscription_status].some((value)=>String(value??'').toLowerCase().includes(normalizedQuery))) : tenants;
  const filteredSessions = normalizedQuery ? sessions.filter((item)=>[item.name,item.organization_name,item.phone_number,item.status].some((value)=>String(value??'').toLowerCase().includes(normalizedQuery))) : sessions;
  const filteredSubscriptions = normalizedQuery ? subscriptions.filter((item)=>[item.organization_name,item.plan_code,item.status].some((value)=>String(value??'').toLowerCase().includes(normalizedQuery))) : subscriptions;

  return <div className="rw-app rw-platform-app">
    <aside className={'rw-sidebar rw-platform-sidebar '+(menu?'open':'')}>
      <Brand href="/platform"/>
      {navigationGroups.map((group)=><div className="rw-platform-nav-group" key={group.label}>
        <span className="rw-nav-label">{group.label.toUpperCase()}</span>
        <nav>
          {group.items.map(([item,icon])=><button key={item} className={active===item?'active':''} onClick={()=>{setActive(item);setMenu(false);}}>
            <span><FeatherIcon name={icon as FeatherName}/></span>{item}
          </button>)}
        </nav>
      </div>)}
      <div className="rw-sidebar-help">
        <span className="rw-nav-label">PLATFORM</span>
        <a href="/dashboard"><FeatherIcon name="grid"/> Customer workspace</a>
        <a href="/api-docs"><FeatherIcon name="external"/> API documentation</a>
        <a href="/"><FeatherIcon name="left"/> Visit website</a>
      </div>
      <div className="rw-account">
        <div className="rw-account-identity">
          <span className="rw-avatar">{(adminName.trim()?adminName.trim().split(/\s+/).slice(0,2).map((part)=>part[0]).join(''):adminEmail.slice(0,2)).toUpperCase()||'PA'}</span>
          <div><strong title={adminName||adminEmail}>{adminName||'Platform Admin'}</strong><small title={adminEmail}>{adminEmail||'Private control plane'}</small></div>
        </div>
        <button className="rw-signout" aria-label="Sign out" onClick={accountLogout}><FeatherIcon name="logout" size={16}/><span>Sign out</span></button>
      </div>
    </aside>

    <main className="rw-main">
      <header className="rw-topbar">
        <button className="rw-menu" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}><FeatherIcon name="menu"/></button>
        <div><a href="/platform">Platform</a><span>/</span><span>{active}</span></div>
        <a href="/api-docs">Documentation <FeatherIcon name="external" size={13}/></a>
      </header>

      <div className="rw-body rw-platform-body">
        <div className="rw-page-heading">
          <div><p className="rw-kicker">PLATFORM ADMINISTRATION</p><h1>{active}</h1><p>{platformSubtitle(active)}</p></div>
          <button className="rw-button secondary" onClick={()=>void refresh()}><FeatherIcon name="refresh" size={14}/> Refresh</button>
        </div>

        {['Organizations','Sessions','Subscriptions'].includes(active) && <div className="rw-platform-toolbar">
          <label className="rw-platform-search"><FeatherIcon name="search" size={14}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search tenants, numbers, plans…"/></label>
          <span className="rw-platform-production"><i/>Production</span>
        </div>}

        {error && <div className="rw-alert">{error}</div>}
        {notice && <div className="rw-notice">{notice}</div>}

      {active === 'Overview' && <>
        <section className="rw-dashboard-welcome rw-platform-welcome">
          <div className="rw-dashboard-intro">
            <span className="rw-dashboard-eyebrow">PRIVATE CONTROL PLANE</span>
            <h2>Everything operational, in one RelayWA workspace.</h2>
            <p>Monitor customer organizations, WhatsApp connections, subscriptions, payments and infrastructure with the same focused UI used by tenants.</p>
            <div className="rw-dashboard-actions">
              <button className="rw-button" onClick={()=>setActive('Sessions')}><FeatherIcon name="smartphone" size={14}/> Review sessions</button>
              <button className="rw-button secondary" onClick={()=>setActive('Diagnostics')}><FeatherIcon name="bell" size={14}/> Open diagnostics</button>
              <a className="rw-dashboard-docs" href="/api-docs">API documentation <FeatherIcon name="right" size={13}/></a>
            </div>
          </div>
          <div className="rw-dashboard-connection">
            <div className="rw-dashboard-connection-head"><span className="rw-dashboard-phone"><FeatherIcon name="shield" size={18}/></span><span>Platform health</span><span className={'rw-dashboard-status '+(healthyWorkers?'online':'')}>{healthyWorkers?'Operational':'Review needed'}</span></div>
            <div className="rw-dashboard-connection-count"><strong>{connected}<span> sessions</span></strong><span>currently connected</span></div>
            <div className="rw-dashboard-connection-foot"><span>{healthyWorkers} healthy worker lease{healthyWorkers===1?'':'s'}</span><button onClick={()=>setActive('Infrastructure')}>View infrastructure <FeatherIcon name="right" size={13}/></button></div>
          </div>
        </section>
        <section className="rw-stats rw-platform-stats">
          <Metric label="Organizations" value={overview?.organizations ?? 0} detail="Customer tenants"/>
          <Metric label="Connected sessions" value={connected} detail={sessions.length + ' total sessions'}/>
          <Metric label="Users" value={overview?.users ?? 0} detail="Platform accounts"/>
          <Metric label="Pending manual payments" value={pendingManual} detail="Needs review"/>
          <Metric label="Failed outbound" value={failedMessages} detail="Message failures"/>
          <Metric label="Failed webhooks" value={overview?.failedWebhooks ?? 0} detail="Delivery failures"/>
        </section>
        <section className="rw-grid-two rw-platform-grid-two">
          <Panel title="Recent organizations">{tenants.slice(0,6).map((t)=><TenantRow key={t.id} tenant={t}/>)}{!tenants.length && <Empty text="No organizations yet."/>}</Panel>
          <Panel title="WhatsApp health">{sessions.slice(0,6).map((s)=><SessionRow key={s.id} session={s}/>)}{!sessions.length && <Empty text="No sessions yet."/>}</Panel>
        </section>
      </>}

      {active === 'Organizations' && <TableSection eyebrow="Tenants" title="Customer organizations" subtitle="Organization, plan, membership and session footprint.">
        <div className="platform-row platform-row-head"><span>Organization</span><span>Plan</span><span>Members</span><span>Sessions</span><span>Subscription</span><span>Created</span></div>
        {filteredTenants.map((t)=><div className="platform-row" key={t.id}><span><strong>{t.name}</strong><small>{t.slug}</small></span><span>{t.plan_code ?? '—'}</span><span>{t.members}</span><span>{t.sessions}</span><span><Badge value={t.subscription_status ?? 'none'}/></span><span>{date(t.created_at)}</span></div>)}
      </TableSection>}

      {active === 'Sessions' && <TableSection eyebrow="WhatsApp" title="All linked sessions" subtitle="Live number, customer, worker ownership and connection state.">
        <div className="platform-row platform-row-head session-admin-row"><span>Session</span><span>Organization</span><span>WhatsApp number</span><span>Status</span><span>Engine</span><span>Worker</span><span>Last connected</span><span>Actions</span></div>
        {filteredSessions.map((s)=>{ const paused=false; return <div className="platform-row session-admin-row" key={s.id}><span><strong>{s.name}</strong><small>{s.display_name || 'No profile name'}</small></span><span>{s.organization_name}</span><span className="phone-cell">{s.phone_number ? '+' + s.phone_number : 'Not linked'}</span><span><Badge value={paused?'safety_paused':s.status}/>{paused && <small>{s.messaging_pause_reason || 'Safety Governor pause'} · until {date(s.messaging_paused_until)}</small>}</span><span><select className="table-select engine-select" value={s.next_engine ?? s.engine ?? 'baileys'} onChange={(e)=>void changeSessionEngine(s.id,e.target.value as 'baileys'|'chromium')}><option value="baileys">Baileys</option><option value="chromium">Chromium</option></select><small>{s.next_engine ? 'Active: ' + s.engine + ' · Next: ' + s.next_engine : 'Active: ' + (s.engine ?? 'baileys')}</small></span><span>{s.worker_id ?? '—'}</span><span>{date(s.last_connected_at)}</span><span className="row-actions">{paused && <button className="mini-button" onClick={()=>void resumeSessionMessaging(s.id)}>Resume sending</button>}{s.status==='connected'?<><button className="mini-button" onClick={()=>void sessionControl(s.id,'restart')}>Restart</button><button className="mini-button danger-mini" onClick={()=>void sessionControl(s.id,'logout')}>Logout</button></>:<button className="mini-button" onClick={()=>void sessionControl(s.id,'connect')}>Connect</button>}</span></div>})}
      </TableSection>}

      {active === 'Messaging' && <>
      <section className="rw-card rw-platform-card auth-settings-panel">
        <PanelHeading eyebrow="Messaging runtime" title="WhatsApp engine" subtitle="Choose the default engine for newly created WhatsApp sessions."/>
        <div className="provider-grid">
          <article className="provider-card">
            <div><p className="eyebrow">Default / scalable</p><h3>Baileys</h3></div>
            <Badge value={messagingEngine==='baileys'?'selected':'available'}/>
            <p className="muted">Lightweight WebSocket-based WhatsApp Web protocol client. Best for density, lower RAM usage and many tenant sessions.</p>
            <button className={messagingEngine==='baileys'?'primary-button':'secondary-button'} onClick={()=>setMessagingEngine('baileys')}>{messagingEngine==='baileys'?'Selected':'Use Baileys'}</button>
          </article>
          <article className="provider-card">
            <div><p className="eyebrow">Browser compatibility</p><h3>Chromium / WhatsApp Web</h3></div>
            <Badge value={messagingEngine==='chromium'?'selected':'available'}/>
            <p className="muted">Runs a persistent real WhatsApp Web browser session through Puppeteer. Higher RAM/CPU usage and lower session density.</p>
            <button className={messagingEngine==='chromium'?'primary-button':'secondary-button'} onClick={()=>setMessagingEngine('chromium')}>{messagingEngine==='chromium'?'Selected':'Use Chromium'}</button>
          </article>
        </div>
        <div className="settings-help">
          <strong>Safe switching policy</strong>
          <p>Changing the platform default affects new sessions only. For an existing connected session, a per-session engine choice is saved as the next engine while the current authenticated engine keeps running. RelayWA never logs out a working session or forces a QR scan just because this setting changes.</p>
        </div>
        <button className="primary-button" onClick={()=>void saveMessagingEngine()}>Save messaging engine</button>
      </section>
      <section className="rw-card rw-platform-card"><PanelHeading eyebrow="Direct sending" title="Application-managed delivery" subtitle="RelayWA sends immediately. Configure scheduling, retries, and message pacing in Laravel Jobs or your application's job system."/></section>
      </>}

      {active === 'Subscriptions' && <TableSection eyebrow="Commercial" title="Subscriptions" subtitle="Plan state, renewals, trials and configured quotas.">
        <div className="platform-row platform-row-head subscription-admin-row"><span>Organization</span><span>Plan</span><span>Status</span><span>Period end</span><span>Sessions</span><span>Messages/mo</span><span>Controls</span></div>
        {filteredSubscriptions.map((s)=><div className="platform-row subscription-admin-row" key={s.organization_id}><span><strong>{s.organization_name}</strong><small>{s.provider || 'Internal / trial'}</small></span><span><select className="table-select" value={s.plan_code} onChange={(e)=>void updateSubscription(s.organization_id,{planCode:e.target.value})}>{[['trial','Trial'],['starter','Basic'],['growth','Pro'],['plus','Plus'],['scale','Business']].map(([plan,label])=><option value={plan} key={plan}>{label}</option>)}</select></span><span><select className="table-select" value={s.status} onChange={(e)=>void updateSubscription(s.organization_id,{status:e.target.value})}>{['trialing','active','past_due','paused','canceled','expired'].map((status)=><option value={status} key={status}>{status}</option>)}</select></span><span>{date(s.current_period_end)}</span><span>{s.max_sessions}</span><span>{Number(s.monthly_messages).toLocaleString()}</span><span><button className="mini-button" onClick={()=>void updateSubscription(s.organization_id,{extendDays:7})}>+7 days</button></span></div>)}
      </TableSection>}

      {active === 'Payments' && <TableSection eyebrow="Revenue" title="Payments" subtitle="Stripe and manual payment activity across all tenants.">
        <div className="platform-row platform-row-head"><span>Organization</span><span>Provider</span><span>Plan</span><span>Amount</span><span>Status</span><span>Action</span></div>
        {payments.map((p)=><div className="platform-row" key={p.id}><span><strong>{p.organization_name}</strong><small>{date(p.created_at)}</small></span><span>{p.provider}</span><span>{p.plan_code} / {p.billing_interval}</span><span>{money(p.amount_cents,p.currency)}</span><span><Badge value={p.status}/></span><span>{p.provider==='manual' && p.status==='pending'?<button className="mini-button" onClick={()=>void approveManual(p.id)}>Approve</button>:'—'}</span></div>)}
      </TableSection>}

      {active === 'Infrastructure' && <section className="rw-grid-two rw-platform-grid-two">
        <Panel title="Worker leases">{workers.map((w)=><div className="session-row" key={w.worker_id}><div className="session-avatar small">WK</div><div className="grow"><strong>{w.worker_id}</strong><span>{w.connected_sessions} connected · {w.owned_sessions} owned</span></div><Badge value={new Date(w.lease_expires_at).getTime()>Date.now()?'healthy':'expired'}/></div>)}{!workers.length && <Empty text="No workers found."/>}</Panel>
        <Panel title="Queue state"><QueueSummary queues={queues}/></Panel>
      </section>}

      {active === 'Providers' && <section className="rw-card rw-platform-card">
        <PanelHeading eyebrow="Payments" title="Payment providers" subtitle="Enable or disable platform-level payment methods. Secrets remain environment-only."/>
        <div className="provider-grid">{providers.map((provider)=><article className="provider-card" key={provider.provider}><div><p className="eyebrow">{provider.provider}</p><h3>{provider.provider==='stripe'?'Stripe Checkout':'Manual / offline'}</h3></div><Badge value={provider.enabled?'enabled':'disabled'}/><p className="muted">{provider.provider==='stripe'?'Online card payments through Stripe Checkout.':'For bank transfer, cash or locally arranged payments.'}</p><button className={provider.enabled?'secondary-button':'primary-button'} onClick={()=>void toggleProvider(provider)}>{provider.enabled?'Disable':'Enable'}</button></article>)}</div>
      </section>}

      {active === 'Authentication' && <section className="rw-card rw-platform-card auth-settings-panel">
        <PanelHeading eyebrow="Authentication" title="Tenant login providers" subtitle="Email/password remains available. Google and GitHub apply only to customer signup/login; Platform Admin keeps its separate private login."/>

        <div className="auth-provider-card">
          <div className="auth-provider-head">
            <div className="google-provider-logo">G</div>
            <div className="grow"><h3>Google</h3><p className="muted">Google Identity Services sign-in for tenant registration and login.</p></div>
            <label className="settings-toggle"><input type="checkbox" checked={googleEnabled} onChange={(e)=>setGoogleEnabled(e.target.checked)}/><span>{googleEnabled?'Enabled':'Disabled'}</span></label>
          </div>
          <div className="auth-settings-form">
            <label>Google Client ID
              <input value={googleClientId} onChange={(e)=>setGoogleClientId(e.target.value)} placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"/>
            </label>
            <div className="settings-help">
              <strong>Google Cloud setup</strong>
              <p>Add the canonical RelayWA site as an Authorized JavaScript origin:</p>
              <code>https://relaywa.com</code>
              <p>RelayWA verifies the returned Google ID token server-side. A Google Client Secret is not required for this flow.</p>
            </div>
            <button className="primary-button" onClick={()=>void saveGoogleAuth()}>Save Google settings</button>
          </div>
        </div>

        <div className="auth-provider-card github-provider-card">
          <div className="auth-provider-head">
            <div className="github-provider-logo">GH</div>
            <div className="grow"><h3>GitHub</h3><p className="muted">GitHub OAuth for tenant registration and login with verified-email account linking.</p></div>
            <label className="settings-toggle"><input type="checkbox" checked={githubEnabled} onChange={(e)=>setGithubEnabled(e.target.checked)}/><span>{githubEnabled?'Enabled':'Disabled'}</span></label>
          </div>
          <div className="auth-settings-form">
            <label>GitHub OAuth App Client ID
              <input value={githubClientId} onChange={(e)=>setGithubClientId(e.target.value)} placeholder="Ov23li..."/>
            </label>
            <div className="settings-help">
              <strong>GitHub OAuth App setup</strong>
              <p>Homepage URL:</p>
              <code>https://relaywa.com</code>
              <p>Authorization callback URL:</p>
              <code>https://relaywa.com/api/auth/github/callback</code>
              <p>Client Secret is stored only in the production environment as <code>GITHUB_CLIENT_SECRET</code>.</p>
              <p>{githubSecretConfigured ? '✓ GitHub Client Secret is configured on the server.' : 'GitHub Client Secret is not configured yet; GitHub sign-in cannot be enabled until it is set.'}</p>
            </div>
            <button className="primary-button" onClick={()=>void saveGithubAuth()}>Save GitHub settings</button>
          </div>
        </div>
      </section>}

      {active === 'Diagnostics' && <section className="diagnostics-grid"><Diagnostic title="Session errors" rows={errors?.sessions ?? []}/><Diagnostic title="Message errors" rows={errors?.messages ?? []}/><Diagnostic title="Webhook errors" rows={errors?.webhooks ?? []}/></section>}
      <PlatformSupportBot token={token} onNavigate={(section)=>setActive(section)}/>
      </div>
      <footer className="rw-app-footer">RelayWA Platform · Private administration.<a href="/api-docs">Developer documentation ↗</a></footer>
    </main>
  </div>;
}

function Metric({label,value,detail}:{label:string;value:number|string;detail:string}) { return <article><span>{label}</span><h3>{value}</h3><p>{detail}</p></article>; }
function Panel({title,children}:{title:string;children:React.ReactNode}) { return <section className="rw-card rw-platform-card"><div className="panel-head"><h2>{title}</h2></div>{children}</section>; }
function PanelHeading({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}) { return <div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted panel-subtitle">{subtitle}</p></div></div>; }
function TableSection({eyebrow,title,subtitle,children}:{eyebrow:string;title:string;subtitle:string;children:React.ReactNode}) { return <section className="rw-card rw-platform-card"><PanelHeading eyebrow={eyebrow} title={title} subtitle={subtitle}/><div className="platform-table">{children}</div></section>; }
function TenantRow({tenant}:{tenant:any}) { return <div className="session-row"><div className="session-avatar small">{tenant.name?.slice(0,2).toUpperCase()}</div><div className="grow"><strong>{tenant.name}</strong><span>{tenant.plan_code ?? 'No plan'} · {tenant.sessions} sessions</span></div><Badge value={tenant.subscription_status ?? 'none'}/></div>; }
function SessionRow({session}:{session:any}) { return <div className="session-row"><div className="session-avatar small">WA</div><div className="grow"><strong>{session.name}</strong><span>{session.phone_number ? '+' + session.phone_number : session.organization_name}</span></div><Badge value={session.status}/></div>; }
function Badge({value}:{value:string}) { const safe=String(value || 'unknown').replace(/_/g,' '); return <span className={'state state-' + value}><span className="state-dot"/>{safe}</span>; }

function QueueSummary({queues}:{queues:any}) {
  const groups=[['Messages',queues?.messages],['Webhooks',queues?.webhooks],['Commands',queues?.commands]];
  return <div className="queue-summary">{groups.map(([label,rows]:any)=><div className="queue-group" key={label}><strong>{label}</strong><div>{(rows??[]).map((r:any)=><span key={r.status}><b>{r.count}</b>{r.status}</span>)}</div></div>)}</div>;
}

function Diagnostic({title,rows}:{title:string;rows:any[]}) { return <section className="rw-card rw-platform-card"><div className="panel-head"><h2>{title}</h2><span className="count-badge">{rows.length}</span></div>{rows.length?rows.slice(0,30).map((r,i)=><div className="diagnostic-row" key={r.id??i}><strong>{r.name ?? r.status ?? 'Error'}</strong><span>{r.last_connection_error ?? r.last_error ?? 'Unknown error'}</span><small>{date(r.updated_at)}</small></div>):<Empty text="No recent errors."/>}</section>; }
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }
function date(value?:string|null) { if (!value) return '—'; return new Date(value).toLocaleString(); }
function money(cents:number,currency:string) { try { return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'USD'}).format((Number(cents)||0)/100); } catch { return String((Number(cents)||0)/100) + ' ' + (currency||''); } }


function platformSubtitle(section:string) {
  const subtitles:Record<string,string> = {
    Overview:'Operational health, tenant activity and platform-wide exceptions.',
    Organizations:'Customer workspaces, memberships, plans and session footprint.',
    Sessions:'WhatsApp connection health, engines, workers and recovery controls.',
    Messaging:'Default engine selection and immediate message dispatch.',
    Subscriptions:'Plan lifecycle, quotas, renewals and trial controls.',
    Payments:'Payment activity, manual approvals and provider status.',
    Providers:'Payment provider availability and platform configuration.',
    Infrastructure:'Worker leases and queue state across RelayWA.',
    Authentication:'Customer login providers and OAuth configuration.',
    Diagnostics:'Recent session, message and webhook failures requiring review.',
  };
  return subtitles[section] ?? 'Private RelayWA platform operations.';
}
