'use client';
import Link from 'next/link';
import Image from 'next/image';
import { FeatherIcon } from './feather-icon';
import { trackMarketingEvent } from '../lib/marketing-events';

/**
 * Small shared public/workspace primitives, separate from the interactive
 * tenant dashboard bundle. Keep marketing pages independent of workspace JS.
 */
export type Plan={code:string;name:string;max_sessions:number;monthly_messages:number|null;monthly_price_cents:number;annual_price_cents:number;daily_messages:number|null};
export function Brand({workspace=false}:{workspace?:boolean}){return <Link className="rw-brand" href={workspace?"/dashboard":"/"} aria-label={workspace?"RelayWa dashboard":"RelayWa home"}><Image className="rw-wordmark" src="/brand/relaywa-textlogo-web.png" width={145} height={35} alt="RelayWA" fetchPriority="high"/></Link>;}
export function Badge({status}:{status:string}){return <span className={'rw-badge '+(['connected','active','sent','delivered'].includes(status)?'good':'')}><i/>{status.replaceAll('_',' ')}</span>;}
export function PlanCards({plans,annual,onChoose,currentPlanCode}:{plans:Plan[];annual:boolean;onChoose?:(p:Plan)=>void;currentPlanCode?:string}){return <div className="rw-plans">{plans.filter(p=>p.code!=='trial').map(p=><article key={p.code} className={'rw-plan '+(p.code==='growth'?'featured':'')}>{p.code==='growth'&&<span className="rw-popular">MOST POPULAR</span>}<h3>{p.name}</h3><p>Connect {p.max_sessions} WhatsApp {p.max_sessions===1?'number':'numbers'}.</p><div className="rw-price">${((annual?p.annual_price_cents/12:p.monthly_price_cents)/100).toFixed(2).replace('.00','')}<small>/ month</small></div><p>{annual?`$${(p.annual_price_cents/100).toFixed(2)} billed yearly`:'Billed monthly'}</p><ul><li>{p.max_sessions} connected {p.max_sessions===1?'number':'numbers'}</li><li>{p.monthly_messages===null?'No monthly message cap':p.monthly_messages.toLocaleString()+' messages / month'}</li><li>Text, media, contacts & locations</li><li>Session API credentials</li><li>Real-time webhooks</li><li>Delivery logs & webhooks</li></ul>{onChoose?<button className="rw-button rw-plan-cta" disabled={p.code===currentPlanCode} onClick={()=>onChoose(p)}><FeatherIcon name={p.code===currentPlanCode?"check":"credit"} size={17}/><span>{p.code===currentPlanCode?"Current plan":"Choose "+p.name}</span>{p.code!==currentPlanCode&&<FeatherIcon name="right" size={14}/>}</button>:<Link className="rw-button rw-plan-cta" href={'/register?plan='+p.code+'&interval='+(annual?'annual':'monthly')} onClick={()=>trackMarketingEvent('plan_select',{cta_position:'pricing',plan_code:p.code as 'starter'|'growth'|'plus'|'scale'})}><FeatherIcon name="events" size={17}/><span>Start with {p.name}</span> <FeatherIcon name="right" size={16}/></Link>}</article>)}</div>;}
