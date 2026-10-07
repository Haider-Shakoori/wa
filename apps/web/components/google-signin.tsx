'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

type AuthProviders = {
  email?: { enabled?: boolean };
  google?: { enabled?: boolean; clientId?: string };
};

export function GoogleSignIn() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement|null>(null);
  const [error,setError] = useState('');
  const [clientId,setClientId] = useState('');
  const [enabled,setEnabled] = useState(false);
  const [loaded,setLoaded] = useState(false);

  useEffect(()=>{
    let active=true;
    void api<AuthProviders>('/v1/auth/providers')
      .then((providers)=>{
        if (!active) return;
        const google=providers.google;
        setEnabled(Boolean(google?.enabled && google.clientId));
        setClientId(String(google?.clientId ?? ''));
        setLoaded(true);
      })
      .catch(()=>{
        if (!active) return;
        setEnabled(false);
        setClientId('');
        setLoaded(true);
      });
    return ()=>{ active=false; };
  },[]);

  useEffect(()=>{
    if (!loaded || !enabled || !clientId || !ref.current) return;

    const initialize = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !ref.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response:any) => {
          setError('');
          try {
            const result = await api<any>('/v1/auth/google',undefined,{
              method:'POST',
              body:JSON.stringify({credential:response.credential}),
            });
            localStorage.setItem('relaywa_access_token',result.accessToken);
            router.push(result.nextPath || '/onboarding');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
          }
        },
      });
      google.accounts.id.renderButton(ref.current,{
        theme:'outline',
        size:'large',
        shape:'rectangular',
        text:'continue_with',
        width:360,
      });
    };

    if ((window as any).google?.accounts?.id) {
      initialize();
      return;
    }

    const existing=document.querySelector<HTMLScriptElement>('script[data-relaywa-google]');
    if (existing) {
      existing.addEventListener('load',initialize,{once:true});
      return ()=>existing.removeEventListener('load',initialize);
    }

    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';
    script.async=true;
    script.defer=true;
    script.dataset.relaywaGoogle='true';
    script.addEventListener('load',initialize,{once:true});
    document.head.appendChild(script);
    return ()=>script.removeEventListener('load',initialize);
  },[clientId,enabled,loaded,router]);

  if (!loaded || !enabled || !clientId) return null;

  return <div className="google-signin-wrap">
    <div ref={ref}/>
    {error && <div className="alert">{error}</div>}
    <div className="auth-divider"><span>or continue with email</span></div>
  </div>;
}
