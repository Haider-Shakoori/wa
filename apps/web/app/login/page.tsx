'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');

  async function submit(event:FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const result = await api<any>('/v1/auth/login', undefined, {
        method:'POST',
        body:JSON.stringify({email,password}),
      });
      localStorage.setItem('relaywa_access_token', result.accessToken);
      router.push('/dashboard');
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in');
    }
  }

  return <main className="auth-shell">
    <section className="auth-brand">
      <div className="brand-mark large">rW</div>
      <p className="eyebrow">relayWA by BusinessOS</p>
      <h1>One control plane for WhatsApp infrastructure.</h1>
      <p>Connect sessions, send through your applications, monitor delivery and manage billing from one place.</p>
    </section>
    <section className="auth-card">
      <p className="eyebrow">Welcome back</p><h2>Sign in to relayWA</h2>
      <form onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary-button wide" type="submit">Sign in</button>
      </form>
      <p className="muted tiny">Use your relayWA organization account.</p>
    </section>
  </main>;
}
