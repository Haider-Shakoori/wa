'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type StorageStatus = {
  enabled:boolean;configured:boolean;retentionDays:number;maxFileMb:number;
  databaseBytes:number;lastError:string|null;notice:string;
  storageMode:string;databaseOfRecord:string;
};

export function PlatformMessageHistoryStorage({token,canEdit}:{
  token:string;canEdit:boolean;
}) {
  const [settings,setSettings]=useState<StorageStatus|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [retentionDays,setRetentionDays]=useState(7);
  const [maxFileMb,setMaxFileMb]=useState(1024);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let canceled=false;
    void api<StorageStatus>('/platform/settings/message-history',token).then(s=>{
      if(canceled)return;
      setSettings(s);setEnabled(s.enabled);
      setRetentionDays(s.retentionDays);setMaxFileMb(s.maxFileMb);
    }).catch(e=>{if(!canceled)setError(e instanceof Error?e.message:'Could not load storage settings')});
    return ()=>{canceled=true};
  },[token]);

  const bytes=settings?.databaseBytes??0;
  const sizeLabel=bytes>=1024**3?(bytes/1024**3).toFixed(2)+' GB':
    bytes>=1024**2?(bytes/1024**2).toFixed(1)+' MB':
    (bytes/1024).toFixed(0)+' KB';

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy||!canEdit)return;
    if(enabled&&!settings?.configured){setError('The VPS needs a mounted persistent SQLite directory first.');return;}
    if(reason.trim().length<8){setError('Enter an audit reason of at least eight characters.');return;}
    if(!window.confirm('Apply SQLite history settings? Turning off stops future SQLite copies, but does not delete archived history or PostgreSQL message records.'))return;
    setBusy(true);setError('');setNotice('');
    try {
      const saved=await api<StorageStatus>('/platform/settings/message-history',token,{
        method:'PATCH',body:JSON.stringify({enabled,retentionDays,maxFileMb,reason:reason.trim()}),
      });
      setSettings(saved);setReason('');
      setNotice('Saved. Enabled SQLite history captures new terminal message records and cleans up entries beyond retention.');
    } catch(e) {
      setError(e instanceof Error?e.message:'Unable to save storage settings.');
    } finally {setBusy(false);}
  }

  return <section className="panel sqlite-history-settings" aria-label="Message history storage settings">
    <div className="panel-head">
      <div>
        <p className="eyebrow">Platform Settings · Privacy and storage</p>
        <h2>SQLite message history</h2>
        <p className="muted">Optional local SQLite archive of text messages, delivery status and media metadata. Media binary files are never archived here.</p>
      </div>
    </div>

    {!settings&&!error&&<p className="muted">Loading message storage settings…</p>}
    {settings&&<>
      <div className="sqlite-history-status">
        <div><span>Storage mode</span><strong>{settings.enabled?'Enabled':'Disabled'}</strong></div>
        <div><span>Persistent SQLite path</span><strong>{settings.configured?'Configured':'Not configured'}</strong></div>
        <div><span>On-disk database + journals</span><strong>{sizeLabel}</strong></div>
        <div><span>Configured limit</span><strong>{settings.maxFileMb.toLocaleString()} MB</strong></div>
      </div>
      {settings.lastError&&<p role="alert" className="alert">Storage warning: {settings.lastError}</p>}
      <p className="muted sqlite-history-note">{settings.notice}</p>
      {!settings.configured&&<p className="sqlite-history-warning">
        To enable storage, the VPS operator must first mount a persistent directory into the API container and set
        <code>RELAYWA_MESSAGE_HISTORY_SQLITE_PATH</code>. No automatic filesystem or VPS changes are made from this screen.
      </p>}
      <form onSubmit={e=>void save(e)} className="sqlite-history-form">
        <label className="sqlite-history-toggle">
          <input type="checkbox" checked={enabled} disabled={!canEdit||busy||!settings.configured}
            onChange={e=>setEnabled(e.target.checked)}/>
          <span><strong>Enable SQLite message history</strong>
            <small>When off, no new SQLite archive rows are written. Existing SQLite history expires normally under its retention policy.</small></span>
        </label>
        <div className="sqlite-history-fields">
          <label>Retain history (days)
            <input type="number" min={1} max={365} step={1} required value={retentionDays}
              disabled={!canEdit||busy} onChange={e=>setRetentionDays(Number(e.target.value))}/>
          </label>
          <label>SQLite storage limit (MB)
            <input type="number" min={100} max={102400} step={1} required value={maxFileMb}
              disabled={!canEdit||busy} onChange={e=>setMaxFileMb(Number(e.target.value))}/>
          </label>
        </div>
        {canEdit&&<>
          <label>Reason for changing the storage policy
            <textarea rows={2} required minLength={8} maxLength={500}
              value={reason} disabled={busy}
              onChange={e=>setReason(e.target.value)}
              placeholder="Example: Enable seven-day message-history archive"/>
          </label>
          <button type="submit" className="primary-button" disabled={busy||reason.trim().length<8}>
            {busy?'Saving…':'Save message history settings'}
          </button>
        </>}
      </form>
      <p className="muted sqlite-history-note">
        This is an optional archive, not a migration or deletion of PostgreSQL messages.
        It starts with messages created after activation. The delivery queue, webhook retries, customer invoices and usage counters remain in PostgreSQL.
      </p>
    </>}
    {error&&<p role="alert" className="alert">{error}</p>}
    {notice&&<p role="status" className="rw-notice">{notice}</p>}
  </section>;
}
