'use client';

import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type PlatformRole = 'super_admin' | 'billing_admin' | 'support_admin' | 'read_only';

export function PlatformAddAdministrator({token,onCreated,onCancel}:{
  token:string;
  onCreated:()=>Promise<void>;
  onCancel:()=>void;
}) {
  const [email,setEmail]=useState('');
  const [role,setRole]=useState<PlatformRole>('read_only');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    if(reason.trim().length<8){setError('An audit reason of at least eight characters is required.');return;}
    if(!window.confirm('Grant '+role.replaceAll('_',' ')+' platform privileges to '+email.trim()+'? Existing sessions will be revoked and the user must sign in again.'))return;
    setBusy(true);setError('');
    try {
      await api('/platform/administrators',token,{
        method:'POST',body:JSON.stringify({email:email.trim(),role,reason:reason.trim()}),
      });
      await onCreated();
      onCancel();
    } catch(err) {
      setError(err instanceof Error?err.message:'Unable to grant administrator access.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="platform-admin-create" aria-label="Add administrator">
    <div>
      <strong>Add administrator</strong>
      <p className="muted">Enter the email of an existing RelayWA account. If the person does not have an account, have them register on the website first. Their current password is never changed.</p>
    </div>
    <form onSubmit={e=>void submit(e)}>
      <label>Email address
        <input type="email" maxLength={254} required autoComplete="off" value={email}
          onChange={e=>setEmail(e.target.value)} placeholder="colleague@example.com"/>
      </label>
      <label>Platform role
        <select value={role} onChange={e=>setRole(e.target.value as PlatformRole)}>
          <option value="read_only">Read-only</option>
          <option value="support_admin">Support Admin</option>
          <option value="billing_admin">Billing Admin</option>
          <option value="super_admin">Super Admin (full access)</option>
        </select>
      </label>
      <label className="platform-admin-create-reason">Reason for access
        <textarea required minLength={8} maxLength={240} rows={2}
          placeholder="Example: Assigned to manage customer subscriptions"
          value={reason} onChange={e=>setReason(e.target.value)}/>
      </label>
      <p className="muted">Adding access is audited and invalidates that person's current login sessions. Their tenant data and WhatsApp sessions remain unchanged.</p>
      {error&&<p className="alert" role="alert">{error}</p>}
      <div className="platform-admin-create-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary-button" disabled={busy||!email||reason.trim().length<8}>
          {busy?'Adding…':'Grant administrator access'}
        </button>
      </div>
    </form>
  </section>;
}
