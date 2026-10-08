'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Brand } from '../../../components/relay-workspace';

export default function PlatformLoginPage() {
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [expired,setExpired]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    setExpired(new URLSearchParams(window.location.search).get('expired')==='1');
    const current=localStorage.getItem('relaywa_access_token');
    if (!current) return;
    // Platform access is checked independently of an existing client login.
    // Never erase a valid client token just because its platform role is denied.
    let mounted=true;
    void api('/platform/whoami',current).then(()=>{
      if(mounted)router.replace('/platform');
    }).catch(async()=>{
      try {
        await api('/auth/me',current);
        if(mounted)router.replace('/dashboard');
      }catch{
        // Only a genuinely invalid/expired login belongs on the login form.
        if(mounted)localStorage.removeItem('relaywa_access_token');
      }
    });
    return ()=>{mounted=false;};
  },[router]);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result=await api<any>('/auth/login',undefined,{
        method:'POST',
        body:JSON.stringify({email,password}),
      });
      if (!result.isPlatformAdmin) {
        throw new Error('This account does not have RelayWA platform administrator access.');
      }
      if (result.mfaRequired && result.mfaTicket) {
        sessionStorage.setItem('relaywa_platform_mfa_ticket',result.mfaTicket);
        router.replace('/platform/mfa');
        return;
      }
      localStorage.setItem('relaywa_access_token',result.accessToken);
      router.replace('/platform');
    } catch(err) {
      localStorage.removeItem('relaywa_access_token');
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return <main className="split-login-shell platform-login-shell">
    <section className="split-login-brand">
      <Brand/>
      <div>
        <span className="public-kicker">Private administration</span>
        <h1>Operate RelayWA separately from customer workspaces.</h1>
        <p>Manage tenants, subscriptions, payment providers, WhatsApp engines, messaging safety, workers and diagnostics from the private platform control plane.</p>
      </div>
      <div className="platform-login-note">Customer accounts sign in at <strong>relaywa.com/login</strong>. This page is reserved for RelayWA platform administrators.</div>
    </section>
    <section className="split-login-panel">
      <form className="light-auth-card" onSubmit={submit}>
        <p className="eyebrow">Platform administrator</p>
        <h2>Sign in to the control plane</h2>
        <p className="light-auth-copy">Use your RelayWA platform administrator credentials.</p>
        <label>Email address<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/></label>
        <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required minLength={8}/></label>
        {expired && !error && <div className="alert" role="status">Your session expired. Please sign in again.</div>}
        {error && <div className="alert">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy?'Signing in…':'Sign in to platform'}</button>
        <a className="auth-back-link" href="/login">Customer workspace sign in →</a>
      </form>
    </section>
  </main>;
}
