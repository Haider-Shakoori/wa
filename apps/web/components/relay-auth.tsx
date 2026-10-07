'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand } from './relay-workspace';
import { FeatherIcon } from './feather-icon';
import { api } from '../lib/api';
import { GoogleSignIn } from './google-signin';
import { GithubSignIn } from './github-signin';

function tenantDestination(result:any, register:boolean) {
  const chosen = new URLSearchParams(window.location.search);
  const plan = chosen.get('plan');
  if (register && plan) {
    return '/subscription?plan=' + encodeURIComponent(plan)
      + '&interval=' + encodeURIComponent(chosen.get('interval') || 'monthly');
  }
  // Returning customers always land in their dashboard; onboarding stays an optional setup flow.
  if (!register) return result?.isPlatformAdmin ? '/platform' : '/dashboard';
  return result?.nextPath ?? '/onboarding';
}

export default function RelayAuth({ register=false }: { register?: boolean }) {
  const router=useRouter();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [visible,setVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const githubError=params.get('github_error');
    const githubCode=params.get('github_code');

    if (githubError) {
      setError(githubError === 'access_denied'
        ? 'GitHub sign-in was cancelled.'
        : 'GitHub sign-in could not be completed. Please try again.');
      params.delete('github_error');
      const next=window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({},'',next);
      return;
    }

    if (!githubCode) return;

    let active=true;
    setBusy(true);
    setError('');
    void api<any>('/auth/github/exchange',undefined,{
      method:'POST',
      body:JSON.stringify({code:githubCode}),
    }).then((result)=>{
      if (!active) return;
      localStorage.setItem('relaywa_access_token',result.accessToken);
      params.delete('github_code');
      const cleaned=window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({},'',cleaned);
      router.replace(tenantDestination(result,register));
    }).catch((err)=>{
      if (!active) return;
      setError(err instanceof Error ? err.message : 'GitHub sign-in failed.');
      params.delete('github_code');
      const cleaned=window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({},'',cleaned);
    }).finally(()=>{
      if (active) setBusy(false);
    });

    return ()=>{active=false;};
  },[router,register]);

  async function submit(e:FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result=await api<any>('/auth/'+(register?'register':'login'),undefined,{
        method:'POST',
        body:JSON.stringify(register?{name,email,password}:{email,password}),
      });
      localStorage.setItem('relaywa_access_token',result.accessToken);
      router.push(tenantDestination(result,register));
    } catch (err) {
      setError(err instanceof Error?err.message:'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="rw-auth">
    <section className="rw-auth-story">
      <Brand/>
      <div>
        <p className="rw-kicker">ONE CONNECTION. ENDLESS POSSIBILITIES.</p>
        <h1>Your app.<br/>Their WhatsApp.<br/><em>Connected.</em></h1>
        <p>Turn your next idea into a working integration. Connect your numbers, send through the API, and keep every session under control.</p>
      </div>
      <small>Built for developers, by developers.</small>
    </section>

    <section className="rw-auth-panel">
      <div className="rw-auth-card">
        <Link className="rw-auth-back" href="/"><FeatherIcon name="left" size={14}/> Back to RelayWA</Link>
        <h1>{register?'Start building with RelayWA':'Welcome back.'}</h1>
        <p>{register?'Your 7-day trial starts here. No payment card required.':'Sign in to manage your sessions and integrations.'}</p>

        {error&&<div className="rw-alert" role="alert">{error}</div>}

        <div className="social-auth-stack">
          <GoogleSignIn preservePlan={register}/>
          <GithubSignIn/>
        </div>
        <div className="auth-divider"><span>or continue with email</span></div>

        <form onSubmit={submit}>
          {register&&<label>Your name
            <span className="rw-input-icon">
              <FeatherIcon name="user" size={16}/>
              <input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/>
            </span>
          </label>}
          <label>Email address
            <span className="rw-input-icon">
              <FeatherIcon name="mail" size={16}/>
              <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
            </span>
          </label>
          <label>Password
            <span className="rw-input-icon rw-password-input">
              <FeatherIcon name="lock" size={16}/>
              <input type={visible?'text':'password'} required minLength={8} autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/>
              <button className="rw-password-toggle" type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>
                <FeatherIcon name={visible?'eyeOff':'eye'} size={16}/>
              </button>
            </span>
          </label>
          {register&&<small>Use at least 8 characters.</small>}
          <button className="rw-button" disabled={busy}>{busy?'Please wait…':register?'Create your account':'Sign in'}</button>
        </form>

        <p className="rw-auth-switch">{register?'Already have an account?':'New to RelayWA?'} <Link href={register?'/login':'/register'}>{register?'Sign in':'Start your free trial'}</Link></p>
      </div>
    </section>
  </main>;
}
