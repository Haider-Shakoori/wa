'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export function PlatformMfaSettings({token}:{token:string}) {
  const router=useRouter();
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const [secret,setSecret]=useState('');
  const [uri,setUri]=useState('');
  const [code,setCode]=useState('');
  const [backupCodes,setBackupCodes]=useState<string[]>([]);
  const [sessions,setSessions]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function refresh() {
    const [status,active]=await Promise.all([
      api<{enabled:boolean}>('/auth/mfa/status',token),
      api<any[]>('/auth/sessions',token),
    ]);
    setEnabled(status.enabled);setSessions(active);
  }
  useEffect(()=>{if(token)void refresh().catch(e=>setError(e instanceof Error?e.message:'Unable to load account security'));},[token]);

  async function setup() {
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<{secret:string;otpauthUrl:string}>('/auth/mfa/setup',token,{method:'POST'});
      setSecret(result.secret);setUri(result.otpauthUrl);
    }catch(e){setError(e instanceof Error?e.message:'Setup failed');}
    finally{setBusy(false);}
  }
  async function confirm() {
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<{recoveryCodes:string[]}>('/auth/mfa/confirm',token,{
        method:'POST',body:JSON.stringify({code:code.trim()}),
      });
      setBackupCodes(result.recoveryCodes);
      setEnabled(true);setSecret('');setUri('');setCode('');
      localStorage.removeItem('relaywa_access_token');
      setNotice('MFA is enabled. Save your recovery codes now; they will not be shown again. You must sign in again.');
    }catch(e){setError(e instanceof Error?e.message:'Invalid code');}
    finally{setBusy(false);}
  }
  async function revoke(sessionId:string){
    if(!window.confirm('Revoke this login session?'))return;
    setError('');
    try {
      await api('/auth/sessions/'+sessionId+'/revoke',token,{method:'POST'});
      await refresh();setNotice('Session revoked. That device must sign in again.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to revoke session');}
  }
  async function revokeAll(){
    if(!window.confirm('Sign out every login session, including your current device?'))return;
    setError('');
    try{
      await api('/auth/sessions/revoke-all',token,{method:'POST'});
      localStorage.removeItem('relaywa_access_token');
      router.replace('/platform/login');
    }catch(e){setError(e instanceof Error?e.message:'Unable to revoke logins');}
  }
  return <section className="panel platform-detail-panel">
    <div className="panel-head"><div><p className="eyebrow">Account protection</p>
      <h2>Authenticator MFA & devices</h2>
      <p className="muted">Use an authenticator app for time-based codes. Existing sign-in sessions can be revoked without affecting WhatsApp connections.</p></div></div>
    {error&&<p role="alert" className="alert">{error}</p>}
    {notice&&<p role="status" className="muted">{notice}</p>}
    <p><strong>Authenticator:</strong> {enabled===null?'Loading…':enabled?'Enabled':'Not enabled'}</p>
    {enabled===false&&!secret&&<button className="primary-button" disabled={busy} onClick={()=>void setup()}>Set up authenticator MFA</button>}
    {secret&&<div className="platform-mfa-setup">
      <p>In your authenticator app, choose Add account, then enter this setup key manually. Do not share it.</p>
      <code>{secret}</code>
      <small>Or use the authenticator URI: <code>{uri}</code></small>
      <label>Six-digit authenticator code
        <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={e=>setCode(e.target.value)} placeholder="123456"/>
      </label>
      <button className="primary-button" disabled={busy||!/^\d{6}$/.test(code)} onClick={()=>void confirm()}>Enable MFA and generate recovery codes</button>
    </div>}
    {backupCodes.length>0&&<div className="platform-mfa-setup">
      <h3>Single-use recovery codes — save now</h3>
      <p>Each code can be used once when you cannot access your authenticator. They are not retrievable later.</p>
      <pre>{backupCodes.join('\n')}</pre>
      <button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(backupCodes.join('\n'))}>Copy recovery codes</button>
      <button className="primary-button" onClick={()=>router.replace('/platform/login')}>I saved my codes — sign in again</button>
    </div>}
    <h3 className="platform-profile-heading">Recent login sessions</h3>
    <div className="platform-sessions-list">
      {sessions.map(item=><div className="platform-detail-row" key={item.id}>
        <span><strong>{item.login_method} · IP: {item.ip_address??'Unavailable'}</strong><small>{item.user_agent??'Unknown device'} · {new Date(item.created_at).toLocaleString()}</small></span>
        <span>{item.revoked_at?'Revoked':new Date(item.expires_at).getTime()<Date.now()?'Expired':'Active'}</span>
        {!item.revoked_at&&<button className="mini-button danger-mini" onClick={()=>void revoke(item.id)}>Revoke</button>}
      </div>)}
    </div>
    <button className="secondary-button" disabled={!sessions.length} onClick={()=>void revokeAll()}>Sign out all login sessions</button>
  </section>;
}
