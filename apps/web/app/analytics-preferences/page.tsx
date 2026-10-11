'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ANALYTICS_CONSENT_KEY, ANALYTICS_CHOICE_CHANGED_CHANNEL } from '../../lib/marketing-events';
import { PublicFooter, PublicHeader } from '../../components/relay-home';

type Choice = 'granted' | 'denied' | null;

export default function AnalyticsPreferencesPage() {
  const [choice, setChoice] = useState<Choice>(null);
  const [loaded, setLoaded] = useState(false);
  const [policy, setPolicy] = useState<'pending' | 'auto' | 'consent'>('pending');

  useEffect(() => {
    const readChoice = () => {
      const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      setChoice(stored === 'granted' || stored === 'denied' ? stored : null);
    };
    readChoice();
    setLoaded(true);
    window.addEventListener('storage', readChoice);
    return () => window.removeEventListener('storage', readChoice);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    void fetch('/analytics-policy', {
      cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Regional analytics policy unavailable');
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'policy' in body &&
        (body as { policy: unknown }).policy === 'auto') return 'auto' as const;
      return 'consent' as const;
    }).catch(() => 'consent' as const).then(result => {
      if (!controller.signal.aborted) setPolicy(result);
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  function select(value: 'granted' | 'denied') {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    setChoice(value);
    window.dispatchEvent(new Event(ANALYTICS_CHOICE_CHANGED_CHANNEL));
  }

  const current = !loaded ? 'Loading preferences…'
    : choice === 'denied' ? 'Disabled by your choice'
    : choice === 'granted' ? 'Enabled by your choice'
    : policy === 'auto' ? 'Enabled automatically for eligible visitors'
    : policy === 'consent' ? 'Disabled until you enable it'
    : 'Checking your region…';

  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <section className="rw-site-section" aria-labelledby="analytics-preferences-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">PRIVACY CONTROLS</p>
        <h1 id="analytics-preferences-heading">Analytics preferences</h1>
        <p>RelayWA uses essential technology for the website and optional Google Analytics
        to understand public page usage. You can allow or disable optional analytics here.
        Your selection is saved on this browser and takes precedence over regional defaults.</p>
      </div>
      <div style={{maxWidth:640,margin:'0 auto',padding:24,border:'1px solid #2a3a3b',borderRadius:16,background:'#101b1a'}}>
        <p aria-live="polite"><strong>Google Analytics:</strong> {current}</p>
        <p style={{lineHeight:1.7,color:'#bfd0c9'}}>Optional Google Analytics measures
        public marketing page views and limited interaction events. It does not track
        private workspace pages or WhatsApp message content. The advertising permissions
        remain disabled. Essential service functions are unaffected by your choice.</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:22}}>
          <button type="button" className="rw-button" onClick={()=>select('granted')} disabled={!loaded}>
            Enable optional analytics
          </button>
          <button type="button" className="rw-button secondary" onClick={()=>select('denied')} disabled={!loaded}>
            Disable optional analytics
          </button>
        </div>
        <p style={{marginTop:20,color:'#bdc8c4',fontSize:14}}>
          If you disable analytics after previously enabling it, no new GA4 events will
          be sent from this page session. Past Google Analytics activity cannot be
          retroactively deleted by changing this setting.
        </p>
        <p style={{marginTop:12}}><Link href="/">Return to RelayWA</Link></p>
      </div>
    </section>
    <PublicFooter />
  </main>;
}
