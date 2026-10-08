'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type TrafficReport={
  days:number; generatedAt:string;
  summary:{pageviews:number;human_pageviews:number;declared_bot_hits:number;suspected_bot_hits:number;daily_unique_visitors:number};
  trend:Array<{day:string;human:number;bots:number;suspected:number;unique_visitors:number}>;
  countries:Array<{country_code:string;human:number;bots:number;suspected:number;daily_unique_visitors:number}>;
  bots:Array<{bot_family:string;hits:number;countries:number}>;
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
    {error&&<div className="alert" role="alert">{error}</div>}
    <div className="website-traffic-stats">
      <div className="panel"><span>Human page views</span><strong>{number(summary?.human_pageviews)}</strong><small>Observed document requests</small></div>
      <div className="panel"><span>Daily unique visitors</span><strong>{number(summary?.daily_unique_visitors)}</strong><small>Approximate, privacy-preserving</small></div>
      <div className="panel"><span>Declared crawler hits</span><strong>{number(summary?.declared_bot_hits)}</strong><small>Bot user-agent claims</small></div>
      <div className="panel"><span>Suspected automated hits</span><strong>{number(summary?.suspected_bot_hits)}</strong><small>Non-browser clients and headless tools</small></div>
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
