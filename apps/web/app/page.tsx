'use client';

import { useState } from 'react';

const plans = [
  {
    code:'trial',
    name:'Trial',
    description:'Test RelayWA with one WhatsApp number and full developer access.',
    monthly:0,
    annual:0,
    features:['1 connected WhatsApp number','50 messages per day','Unlimited contacts','Text, images, video & audio','Documents, contacts & locations','Full API access','Real-time webhooks','7-day trial — no card required'],
  },
  {
    code:'basic',
    name:'Basic',
    description:'For individuals and small teams connecting one WhatsApp number.',
    monthly:3.99,
    annual:40.70,
    features:['1 connected WhatsApp number','Unlimited contacts','No daily message cap','30,000 messages / month','Text, images, video & audio','Documents, contacts & locations','Full API access','Real-time webhooks'],
  },
  {
    code:'pro',
    name:'Pro',
    description:'For growing businesses running several customer-facing workflows.',
    monthly:8.99,
    annual:91.70,
    featured:true,
    features:['3 connected WhatsApp numbers','Unlimited contacts','No daily message cap','100,000 messages / month','Text, images, video & audio','Documents, contacts & locations','Full API access','Real-time webhooks','Priority support'],
  },
  {
    code:'plus',
    name:'Plus',
    description:'For expanding teams that need more numbers and message capacity.',
    monthly:16.99,
    annual:173.30,
    features:['6 connected WhatsApp numbers','Unlimited contacts','No daily message cap','250,000 messages / month','Text, images, video & audio','Documents, contacts & locations','Full API access','Real-time webhooks','Priority support'],
  },
  {
    code:'business',
    name:'Business',
    description:'For larger organizations operating up to ten WhatsApp numbers.',
    monthly:24.99,
    annual:254.90,
    features:['10 connected WhatsApp numbers','Unlimited contacts','No daily message cap','500,000 messages / month','Text, images, video & audio','Documents, contacts & locations','Full API access','Real-time webhooks','Priority support'],
  },
];

export default function Home() {
  const [billing,setBilling]=useState<'monthly'|'annual'>('monthly');

  return <main className="public-shell">
    <header className="public-nav">
      <a className="public-brand" href="/"><span className="brand-mark">rW</span><span><strong>relayWA</strong><small>WhatsApp API infrastructure</small></span></a>
      <nav><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="https://app.relaywa.com/login">Sign in</a><a className="public-cta" href="https://app.relaywa.com/login">Start free</a></nav>
    </header>

    <section className="public-hero">
      <div className="public-hero-copy">
        <span className="public-kicker">Built for developers, teams and BusinessOS apps</span>
        <h1>WhatsApp messaging infrastructure without the operational mess.</h1>
        <p>Connect numbers, send from your software through a clean REST API, receive webhooks, manage sessions and control delivery from one reliable workspace.</p>
        <div className="public-actions"><a className="primary-button" href="https://app.relaywa.com/login">Start 7-day trial</a><a className="public-secondary" href="#pricing">View pricing</a></div>
        <div className="public-proof"><span>REST API</span><span>Real-time webhooks</span><span>Multi-session</span><span>Safety Governor</span></div>
      </div>
      <div className="public-preview">
        <div className="preview-top"><span>relayWA</span><span className="preview-live">● API online</span></div>
        <div className="preview-card"><small>CONNECTED NUMBERS</small><strong>3</strong><span>All sessions healthy</span></div>
        <div className="preview-card"><small>MESSAGE QUEUE</small><strong>24</strong><span>Protected by adaptive pacing</span></div>
        <div className="preview-code"><code>POST https://api.relaywa.com/v1/messages</code><span>202 Accepted</span></div>
      </div>
    </section>

    <section className="public-feature-strip" id="features">
      <div><strong>API-first</strong><span>Integrate from Laravel, Node, Python, .NET or any REST client.</span></div>
      <div><strong>Session aware</strong><span>Manage several WhatsApp numbers with isolated credentials and queues.</span></div>
      <div><strong>Operational controls</strong><span>Rate limits, retry policies, alerts and message safety controls.</span></div>
      <div><strong>Event driven</strong><span>Receive inbound messages and delivery state through webhooks.</span></div>
    </section>

    <section className="pricing-section" id="pricing">
      <div className="pricing-heading">
        <div><span className="public-kicker">Simple pricing</span><h2>Start small. Add capacity when you need it.</h2><p>Paid plans have no daily cap. Safety Governor pacing still applies to protect session health.</p></div>
        <div className="billing-switch"><button className={billing==='monthly'?'active':''} onClick={()=>setBilling('monthly')}>Monthly</button><button className={billing==='annual'?'active':''} onClick={()=>setBilling('annual')}>Yearly <span>Save 15%</span></button></div>
      </div>
      <div className="pricing-grid">
        {plans.map((plan)=><article className={plan.featured?'price-card featured':'price-card'} key={plan.code}>
          {plan.featured && <span className="recommended-pill">Most popular</span>}
          <div className="price-card-head"><h3>{plan.name}</h3><p>{plan.description}</p></div>
          <div className="price-value">{plan.monthly===0?<><strong>Free</strong><small>7 days</small></>:billing==='monthly'?<><strong>{'$' + plan.monthly.toFixed(2)}</strong><small>/month</small></>:<><strong>{'$' + plan.annual.toFixed(2)}</strong><small>/year</small></>}</div>
          {billing==='annual' && plan.monthly>0 && <div className="effective-price">{'$' + (plan.annual/12).toFixed(2)} effective monthly</div>}
          <ul>{plan.features.map((feature)=><li key={feature}><span>✓</span>{feature}</li>)}</ul>
          <a className={plan.featured?'primary-button price-action':'public-secondary price-action'} href="https://app.relaywa.com/login">{plan.code==='trial'?'Start free trial':'Choose ' + plan.name}</a>
        </article>)}
      </div>
    </section>

    <footer className="public-footer"><div className="public-brand"><span className="brand-mark">rW</span><span><strong>relayWA</strong><small>by BusinessOS</small></span></div><p>Use RelayWA for legitimate, consent-based messaging and follow applicable WhatsApp policies.</p><a href="https://platform.relaywa.com">Platform administration</a></footer>
  </main>;
}
