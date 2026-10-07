'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export function GoogleSignIn() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement|null>(null);
  const [error,setError] = useState('');
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(()=>{
    if (!clientId || !ref.current) return;

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
  },[clientId,router]);

  if (!clientId) {
    return <button className="social-button" type="button" disabled title="Google OAuth client ID is not configured">
      <span className="google-g">G</span> Continue with Google
    </button>;
  }

  return <div className="google-signin-wrap">
    <div ref={ref}/>
    {error && <div className="alert">{error}</div>}
  </div>;
}
