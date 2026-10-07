'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleSignIn } from '../../components/google-signin';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router=useRouter();
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const path=mode==='login'?'/v1/auth/login':'/v1/auth/register';
      const payload=mode==='login'?{email,password}:{name,email,password};
      const result=await api<any>(path,undefined,{
        method:'POST',
        body:JSON.stringify(payload),
      });
      localStorage.setItem('relaywa_access_token',result.accessToken);
      router.push(result.nextPath || (mode==='register'?'/onboarding':'/dashboard'));
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Unable to continue');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-v2-shell">
    <section className="auth-v2-brand">
      <div className="auth-logo"><div className="brand-mark large">rW</div><div><strong>relayWA</strong><span>by BusinessOS</span></div></div>
      <div className="auth-copy">
        <span className="product-kicker"><span className="live-dot"/>WhatsApp infrastructure for developers</span>
        <h1>Connect once.<br/>Build anything.</h1>
        <p>Link WhatsApp, get an API key and start sending from Laravel, Node, Python, .NET or any REST-capable application.</p>
      </div>
      <div className="auth-proof-grid">
        <div><strong>REST API</strong><span>Developer-first integration</span></div>
        <div><strong>Real-time</strong><span>Webhooks & inbound events</span></div>
        <div><strong>Multi-session</strong><span>One platform, many numbers</span></div>
      </div>
      <p className="auth-footnote">Unofficial linked-device transport. Use consent-based messaging and follow WhatsApp policies.</p>
    </section>

    <section className="auth-v2-panel">
      <div className="auth-v2-card">
        <div className="auth-tabs">
          <button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Sign in</button>
          <button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Create account</button>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">{mode==='login'?'Welcome back':'Start building'}</p>
          <h2>{mode==='login'?'Sign in to relayWA':'Create your relayWA account'}</h2>
          <p>{mode==='login'?'Manage sessions, APIs and billing from your workspace.':'No card required for the trial. Choose your plan after signup.'}</p>
        </div>

        <GoogleSignIn/>

        <form className="auth-v2-form" onSubmit={submit}>
          {mode==='register' && <label>Full name<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" required minLength={2}/></label>}
          <label>Email address<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" required/></label>
          <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder={mode==='register'?'At least 8 characters':'Your password'} required minLength={8}/></label>
          {error && <div className="alert">{error}</div>}
          <button className="primary-button wide auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
        </form>

        <p className="auth-legal">By continuing, you agree to use relayWA for legitimate, consent-based messaging and comply with applicable WhatsApp terms.</p>
      </div>
    </section>
  </main>;
}
