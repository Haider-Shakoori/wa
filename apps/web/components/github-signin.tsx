'use client';

import { useEffect, useState } from 'react';
import { API_BASE, api } from '../lib/api';

type AuthProviders = {
  github?: { enabled?: boolean };
};

export function GithubSignIn() {
  const [enabled,setEnabled] = useState(false);
  const [loaded,setLoaded] = useState(false);

  useEffect(()=>{
    let active=true;
    void api<AuthProviders>('/auth/providers')
      .then((providers)=>{
        if (!active) return;
        setEnabled(Boolean(providers.github?.enabled));
        setLoaded(true);
      })
      .catch(()=>{
        if (!active) return;
        setEnabled(false);
        setLoaded(true);
      });
    return ()=>{active=false;};
  },[]);

  if (!loaded) return null;
  if (!enabled) return <button type="button" className="github-signin-button" disabled title="GitHub sign-in requires OAuth credentials and activation in Platform Admin">Continue with GitHub · Setup required</button>;

  function startGithub() {
    const returnTo = window.location.pathname + window.location.search;
    window.location.assign(
      API_BASE + '/auth/github/start?returnTo=' + encodeURIComponent(returnTo),
    );
  }

  return <button className="github-signin-button" type="button" onClick={startGithub}>
    <span className="github-signin-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="19" height="19" role="img">
        <path fill="currentColor" d="M12 .7A11.3 11.3 0 0 0 8.4 22.8c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2a4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.3 11.3 0 0 0 12 .7Z"/>
      </svg>
    </span>
    Continue with GitHub
  </button>;
}
