'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export type LoginProtectionState = {
  captchaRequired:boolean;captchaAvailable:boolean;
  siteKey:string|null;retryAfterSeconds:number;
};
type TurnstileApi={
  render:(element:HTMLElement,options:{
    sitekey:string;theme:'auto';callback:(value:string)=>void;
    'expired-callback':()=>void;'error-callback':()=>void;
  })=>string;
  remove:(widgetId:string)=>void;
};
declare global {interface Window {turnstile?:TurnstileApi}}
const SCRIPT_URL='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function useAdaptiveLoginChallenge() {
  const [risk,setRisk]=useState<LoginProtectionState|null>(null);
  const [token,setToken]=useState('');
  const [resetKey,setResetKey]=useState(0);
  async function check(email:string) {
    const next=await api<LoginProtectionState>('/auth/login-protection?email='+
      encodeURIComponent(email.trim().toLowerCase()));
    setRisk(next);
    return next;
  }
  function reset() {setToken('');setResetKey(v=>v+1);}
  return {risk,token,setToken,resetKey,check,reset};
}

export function AdaptiveLoginChallenge({status,token,onToken,resetKey}:{
  status:LoginProtectionState|null;token:string;
  onToken:(value:string)=>void;resetKey:number;
}) {
  const host=useRef<HTMLDivElement>(null);
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!status?.captchaRequired || !status.captchaAvailable || !status.siteKey)return;
    let destroyed=false;
    let widgetId:string|null=null;
    setLoadError('');setLoading(true);
    const render=()=>{
      if(destroyed||!host.current||!window.turnstile)return;
      try {
        widgetId=window.turnstile.render(host.current,{
          sitekey:status.siteKey!,theme:'auto',
          callback:(value)=>{if(!destroyed)onToken(value);},
          'expired-callback':()=>{if(!destroyed)onToken('');},
          'error-callback':()=>{if(!destroyed){onToken('');setLoadError('Verification did not load. Please refresh and try again.');}},
        });
        setLoading(false);
      }catch {setLoadError('Security verification could not be initialized.');setLoading(false);}
    };
    const existing=document.querySelector<HTMLScriptElement>('script[data-relaywa-turnstile]');
    if(window.turnstile) render();
    else if(existing) existing.addEventListener('load',render,{once:true});
    else {
      const script=document.createElement('script');
      script.src=SCRIPT_URL;script.async=true;script.dataset.relaywaTurnstile='true';
      script.addEventListener('load',render,{once:true});
      script.addEventListener('error',()=>{if(!destroyed){setLoadError('Unable to load security verification.');setLoading(false);}}, {once:true});
      document.head.appendChild(script);
    }
    return ()=>{
      destroyed=true;
      if(existing)existing.removeEventListener('load',render);
      if(widgetId && window.turnstile)window.turnstile.remove(widgetId);
    };
  },[status?.captchaRequired,status?.captchaAvailable,status?.siteKey,resetKey,onToken]);

  if(!status?.captchaRequired)return null;
  if(!status.captchaAvailable)return <div className="rw-login-security rw-login-security-error" role="alert">
    Too many failed sign-in attempts. Please try again in approximately 15 minutes. Automatic verification is not configured.
  </div>;
  return <div className="rw-login-security" aria-live="polite">
    <strong>Extra security verification</strong>
    <p>Unusual sign-in attempts were detected. Complete the check to continue.</p>
    <div ref={host} className="rw-login-challenge-widget" aria-label="Cloudflare Turnstile verification"/>
    {loading&&<small>Loading verification…</small>}
    {loadError&&<small role="alert">{loadError}</small>}
    {token&&<small className="rw-login-security-ok">Verification complete. You can sign in.</small>}
  </div>;
}
