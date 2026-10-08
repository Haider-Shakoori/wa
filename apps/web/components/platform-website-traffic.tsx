'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type TrafficReport={
  days:number; generatedAt:string;
  summary:{pageviews:number;human_pageviews:number;declared_bot_hits:number;suspected_bot_hits:number;daily_unique_visitors:number;verified_bot_hits:number;unverified_bot_hits:number;excluded_hits:number};
  trend:Array<{day:string;human:number;bots:number;suspected:number;unique_visitors:number}>;
  countries:Array<{country_code:string;human:number;bots:number;suspected:number;daily_unique_visitors:number}>;
  bots:Array<{bot_family:string;hits:number;countries:number}>;
  botCountries:Array<{bot_family:string;country_code:string;hits:number}>;
  pages:Array<{path:string;human:number;automated:number}>;
  sources:Array<{source:string;hits:number}>;
  devices:Array<{device_type:string;hits:number}>;
  note:string;
};
const number=(n:number|undefined)=>n===undefined?'—':Number(n).toLocaleString();
function countryName(code:string){
  if(code==='ZZ')return 'Unknown / unavailable';
  try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code)??code;}
  catch{return code;}
}
function Bar({value,max,kind}:{value:number;max:number;kind?:'bots'|'visitors'|'suspected'}){
  return <span className={'website-traffic-bar website-traffic-bar-'+(kind??'visitors')}>
    <span style={{width:Math.max(0,Math.min(100,value/Math.max(1,max)*100))+'%'}}/>
  </span>;
}

export function PlatformWebsiteTraffic({token}:{token:string}){
  const [days,setDays]=useState<7|30|90>(30);
  const [excludeBrowser,setExcludeBrowser]=useState(false);
  useEffect(()=>{
    setExcludeBrowser(document.cookie.split(';').some(v=>v.trim()==='relaywa_analytics_optout=1'));
  },[]);
  function toggleExclude(){
    const next=!excludeBrowser;
    document.cookie='relaywa_analytics_optout='+ (next?'1':'0') +
      '; Path=/; Max-Age='+ (next?31536000:0) +'; SameSite=Lax'+
      (window.location.protocol==='https:'?'; Secure':'');
    setExcludeBrowser(next);
  }
  const [report,setReport]=useState<TrafficReport|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    if(!token)return;
    try{
      const response=await api<TrafficReport>('/platform/website-traffic?days='+days,token);
      setReport(response);setError('');
    }catch(err){setError(err instanceof Error?err.message:'Could not load website traffic');}
    finally{setLoading(false);}
  },[token,days]);
  useEffect(()=>{
    setLoading(true);void refresh();
    const timer=window.setInterval(()=>void refresh(),60_000);
    return ()=>window.clearInterval(timer);
  },[refresh]);

  const maxTrend=useMemo(()=>Math.max(1,...(report?.trend??[]).map(x=>Number(x.human)+Number(x.bots)+Number(x.suspected))),[report]);
  const maxCountry=useMemo(()=>Math.max(1,...(report?.countries??[]).map(x=>Number(x.human)+Number(x.bots)+Number(x.suspected))),[report]);
  const summary=report?.summary;
  return <section className="platform-website-traffic" aria-label="Website visitor analytics">
    <div className="panel website-traffic-intro">
      <div>
        <p className="eyebrow">Website intelligence · First-party</p>
        <h2>Visitors, countries and crawlers</h2>
        <p className="muted">Public RelayWA page requests, including browsers and crawlers that do not run JavaScript.</p>
        {report&&<small>Updated {new Date(report.generatedAt).toLocaleTimeString()} · UTC day boundaries</small>}
      </div>
      <div className="website-traffic-controls" aria-label="Reporting period">
        {([7,30,90] as const).map(value=><button type="button" key={value}
          aria-pressed={days===value} className={days===value?'is-selected':''}
          onClick={()=>setDays(value)}>{value} days</button>)}
        <button type="button" onClick={()=>void refresh()} disabled={loading}>{loading?'Loading…':'↻ Refresh'}</button>
      </div>
    </div>
    <div className="panel website-traffic-preferences">
      <div><strong>Exclude this browser from future traffic statistics</strong>
        <p className="muted">For administrators and internal testing. Applies to this browser only; other visitors are unaffected.</p>
      </div>
      <button className="secondary-button" type="button" aria-pressed={excludeBrowser}
        onClick={toggleExclude}>{excludeBrowser?'Exclusion enabled':'Exclude my browser'}</button>
    </div>
    {error&&<div className="alert" role="alert">{error}</div>}
    <div className="website-traffic-stats">
      <div className="panel"><span>Human page views</span><strong>{number(summary?.human_pageviews)}</strong><small>Observed document requests</small></div>
      <div className="panel"><span>Daily unique visitors</span><strong>{number(summary?.daily_unique_visitors)}</strong><small>Approximate, privacy-preserving</small></div>
      <div className="panel"><span>Declared crawler hits</span><strong>{number(summary?.declared_bot_hits)}</strong><small>Bot user-agent claims</small></div>
      <div className="panel"><span>Suspected automated hits</span><strong>{number(summary?.suspected_bot_hits)}</strong><small>Non-browser clients and headless tools</small></div>
    </div>
    <div className="panel website-traffic-verification">
      <div><strong>Verified Google/Bing/Apple crawler hits</strong><b>{number(summary?.verified_bot_hits)}</b></div>
      <div><strong>Unverified crawler claims</strong><b>{number(summary?.unverified_bot_hits)}</b></div>
      <div><strong>Excluded test/internal requests</strong><b>{number(summary?.excluded_hits)}</b></div>
      <p className="muted">Verification is based on official crawler IP ranges refreshed daily. Other named bots and stale lists remain unverified/not checked, never automatically trusted.</p>
    </div>
    <div className="panel website-traffic-panel">
      <h3>Traffic trend</h3>
      <p className="muted">Page views per day. Green represents apparent human browsing, violet declared crawlers, and amber other automation.</p>
      <div className="website-traffic-legend"><span>Human</span><span>Bots</span><span>Other automation</span></div>
      <div className="website-traffic-trend" role="img" aria-label="Daily visitor and bot page views">
        {report?.trend.map(item=><div className="website-traffic-day" key={item.day}
          title={item.day+': '+item.human+' human, '+item.bots+' bot, '+item.suspected+' suspected'}>
          <div className="website-traffic-column">
            <span className="visitors" style={{height:(Number(item.human)/maxTrend*100)+'%'}}/>
            <span className="bots" style={{height:(Number(item.bots)/maxTrend*100)+'%'}}/>
            <span className="suspected" style={{height:(Number(item.suspected)/maxTrend*100)+'%'}}/>
          </div>
          <small>{days===7?item.day.slice(5):item.day.slice(8)}</small>
        </div>)}
      </div>
      {!report&&<p className="muted">Loading traffic trends…</p>}
    </div>
    <div className="website-traffic-grid">
      <div className="panel website-traffic-panel">
        <h3>Visitors and bots by country</h3>
        <p className="muted">Countries are based on the configured trusted network country signal. Unknown is shown explicitly.</p>
        <div className="website-traffic-table" role="table" aria-label="Website traffic by country">
          <div className="website-traffic-table-head" role="row"><span>Country</span><span>Human</span><span>Bot</span></div>
          {(report?.countries??[]).map(item=><div className="website-traffic-table-row" role="row" key={item.country_code}>
            <div><strong>{countryName(item.country_code)}</strong><small>{item.country_code==='ZZ'?'Location unavailable':item.country_code}</small>
              <Bar value={Number(item.human)+Number(item.bots)+Number(item.suspected)} max={maxCountry}/></div>
            <span>{number(item.human)}</span>
            <span>{number(Number(item.bots)+Number(item.suspected))}</span>
          </div>)}
          {report&&!report.countries.length&&<p className="muted">No traffic recorded yet. Tracking begins when server-side collection is enabled.</p>}
        </div>
      </div>
      <div className="panel website-traffic-panel">
        <h3>Search crawlers and automated traffic</h3>
        <p className="muted">Names are inferred from declared user agents; they are not independently verified crawler identities.</p>
        {(report?.bots??[]).map(bot=><div className="website-traffic-list-row" key={bot.bot_family}>
          <span><strong>{bot.bot_family??'Unknown automation'}</strong><small>{bot.countries} country categories</small></span>
          <b>{number(bot.hits)}</b>
        </div>)}
        {report&&!report.bots.length&&<p className="muted">No declared crawler or automation hits recorded.</p>}
      </div>
    </div>
    <div className="panel website-traffic-panel">
      <h3>Bot activity by country</h3>
      <p className="muted">Each row identifies the declared crawler family and its observed IP-origin country. User-agent claims are not verified.</p>
      <div className="website-traffic-table" role="table" aria-label="Bot families grouped by country">
        <div className="website-traffic-table-head" role="row">
          <span>Bot family / Country</span><span></span><span>Hits</span>
        </div>
        {(report?.botCountries??[]).map((item,index)=><div className="website-traffic-table-row" key={item.bot_family+item.country_code+index}>
          <div><strong>{item.bot_family}</strong><small>{countryName(item.country_code)} ({item.country_code})</small></div>
          <span></span><span>{number(item.hits)}</span>
        </div>)}
        {report&&!report.botCountries.length&&<p className="muted">No automated page visits recorded yet.</p>}
      </div>
    </div>
    <div className="website-traffic-grid">
      <div className="panel website-traffic-panel">
        <h3>Most visited pages</h3>
        {(report?.pages??[]).map(page=><div className="website-traffic-list-row" key={page.path}>
          <span><strong className="website-traffic-path">{page.path}</strong><small>{page.automated} automated hits</small></span>
          <b>{number(page.human)}</b>
        </div>)}
        {report&&!report.pages.length&&<p className="muted">No pages recorded.</p>}
      </div>
      <div className="panel website-traffic-panel">
        <h3>Human traffic sources</h3>
        {(report?.sources??[]).map(source=><div className="website-traffic-list-row" key={source.source}>
          <span><strong>{source.source}</strong></span><b>{number(source.hits)}</b>
        </div>)}
        {report&&!report.sources.length&&<p className="muted">No referrals recorded.</p>}
      </div>
    </div>
    <p className="website-traffic-disclaimer">{report?.note??'Counts start from activation and do not include historical visitors.'} No raw IPs, cookies, query strings or full user agents are retained.</p>
  </section>;
}
