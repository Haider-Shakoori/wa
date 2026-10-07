'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

export default function PlatformLoginPage() {
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const current=localStorage.getItem('relaywa_access_token');
    if (!current) return;
    void api<any>('/v1/auth/me',current)
      .then(()=>api<any>('/v1/platform/overview',current))
      .then(()=>router.replace('/platform'))
      .catch(()=>localStorage.removeItem('relaywa_access_token'));
  },[router]);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result=await api<any>('/v1/auth/login',undefined,{
        method:'POST',
        body:JSON.stringify({email,password}),
      });
      if (!result.isPlatformAdmin) {
        throw new Error('This account does not have RelayWA platform administrator access.');
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
      <a className="public-brand" href="https://relaywa.com"><span className="brand-mark">rW</span><span><strong>RelayWA</strong><small>Platform control plane</small></span></a>
      <div>
        <span className="public-kicker">Private administration</span>
        <h1>Operate RelayWA separately from customer workspaces.</h1>
        <p>Manage tenants, subscriptions, payment providers, WhatsApp engines, messaging safety, workers and diagnostics from the private platform control plane.</p>
      </div>
      <div className="platform-login-note">Customer accounts use <strong>app.relaywa.com</strong>. This login is reserved for RelayWA platform administrators.</div>
    </section>
    <section className="split-login-panel">
      <form className="light-auth-card" onSubmit={submit}>
        <p className="eyebrow">Platform administrator</p>
        <h2>Sign in to the control plane</h2>
        <p className="light-auth-copy">Use your RelayWA platform administrator credentials.</p>
        <label>Email address<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/></label>
        <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required minLength={8}/></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy?'Signing in…':'Sign in to platform'}</button>
        <a className="auth-back-link" href="https://app.relaywa.com/login">Customer workspace sign in →</a>
      </form>
    </section>
  </main>;
}
