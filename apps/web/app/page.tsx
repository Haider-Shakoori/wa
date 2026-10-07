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

  return <main className="public-shell relaywa-site">
    <header className="public-nav">
      <a className="public-brand" href="/"><span className="brand-mark">rW</span><span><strong>RelayWA</strong><small>WhatsApp API infrastructure</small></span></a>
      <nav>
        <a href="#features">Features</a>
        <a href="#integration">Integration</a>
        <a href="#pricing">Pricing</a>
        <a href="https://app.relaywa.com/login">Sign in</a>
        <a className="public-cta" href="https://app.relaywa.com/login">Start free</a>
      </nav>
    </header>

    <section className="public-hero hero-v5">
      <div className="public-hero-copy">
        <span className="public-kicker">Developer-first WhatsApp API · built for global teams</span>
        <h1>Ship WhatsApp messaging from your app. Keep the infrastructure under control.</h1>
        <p>Connect WhatsApp numbers in international format, send through a clean REST API, receive real-time webhooks and manage session health from one focused workspace.</p>
        <div className="public-actions">
          <a className="primary-button hero-primary" href="https://app.relaywa.com/login">Start 7-day trial</a>
          <a className="public-secondary" href="#integration">Explore the API</a>
        </div>
        <div className="hero-assurance">
          <span><b>✓</b>No card required</span>
          <span><b>✓</b>Multi-session</span>
          <span><b>✓</b>Real-time webhooks</span>
          <span><b>✓</b>Safety controls</span>
        </div>
      </div>

      <div className="hero-product-wrap">
        <div className="hero-product">
          <div className="hero-product-bar">
            <div><span className="product-dot"/><strong>RelayWA API</strong></div>
            <span className="preview-live"><i/>Production online</span>
          </div>

          <div className="hero-product-grid">
            <div className="hero-code-card">
              <div className="hero-code-tabs"><span className="active">Request</span><span>Response</span></div>
              <pre><code>{`POST /v1/messages
Authorization: Bearer rw_live_••••••

{
  "to": "recipient_e164",
  "text": "Your order is ready."
}`}</code></pre>
              <div className="hero-code-result"><span>202 Accepted</span><code>msg_9c84f2</code></div>
            </div>

            <div className="hero-runtime-stack">
              <div className="runtime-card"><small>CONNECTED SESSIONS</small><strong>3</strong><span><i className="ok-dot"/>All healthy</span></div>
              <div className="runtime-card"><small>QUEUE HEALTH</small><strong>12ms</strong><span>Adaptive pacing active</span></div>
              <div className="runtime-card safety"><small>SAFETY GOVERNOR</small><strong>Protected</strong><span>Burst + duplicate controls</span></div>
            </div>
          </div>

          <div className="hero-event-stream">
            <div><span className="event-icon delivered">✓</span><p><strong>message.delivered</strong><small>WhatsApp delivery confirmed</small></p><time>now</time></div>
            <div><span className="event-icon webhook">↗</span><p><strong>webhook.delivered</strong><small>200 OK · 184ms</small></p><time>1s</time></div>
            <div><span className="event-icon inbound">↓</span><p><strong>message.received</strong><small>Inbound event captured</small></p><time>4s</time></div>
          </div>
        </div>
        <div className="hero-float-card"><span>API</span><div><strong>One endpoint</strong><small>Text, media, contacts & locations</small></div></div>
      </div>
    </section>

    <section className="public-feature-strip feature-strip-v5" id="features">
      <div><span className="feature-index">01</span><strong>API-first by design</strong><span>Integrate from Laravel, Node, Python, .NET or any REST-capable application.</span></div>
      <div><span className="feature-index">02</span><strong>Session aware</strong><span>Operate multiple WhatsApp numbers with isolated credentials, queues and health state.</span></div>
      <div><span className="feature-index">03</span><strong>Built-in safeguards</strong><span>Control pacing, retries, duplicate suppression and automatic safety pauses.</span></div>
      <div><span className="feature-index">04</span><strong>Event driven</strong><span>Receive inbound messages, delivery updates and session changes through webhooks.</span></div>
    </section>

    <section className="integration-section" id="integration">
      <div className="integration-copy">
        <span className="public-kicker">Simple integration · serious control</span>
        <h2>From API call to WhatsApp delivery, every step stays visible.</h2>
        <p>RelayWA keeps the developer experience simple while the worker layer handles queues, retries, session routing, delivery events and operational safeguards.</p>
        <div className="integration-points">
          <div><b>01</b><span><strong>Connect a session</strong><small>Link WhatsApp once and keep session health visible.</small></span></div>
          <div><b>02</b><span><strong>Send through the API</strong><small>Use scoped API keys from your own application.</small></span></div>
          <div><b>03</b><span><strong>React to events</strong><small>Receive delivery and inbound updates through webhooks.</small></span></div>
        </div>
      </div>
      <div className="integration-console">
        <div className="console-head"><span>Live request</span><span>JavaScript</span></div>
        <pre><code>{`const response = await fetch(
  "https://api.relaywa.com/v1/messages",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: "93744119422",
      text: "Payment received. Thank you."
    })
  }
);`}</code></pre>
        <div className="console-response"><span>✓ Accepted into queue</span><code>202</code></div>
      </div>
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

    <footer className="public-footer">
      <div className="public-brand"><span className="brand-mark">rW</span><span><strong>RelayWA</strong><small>WhatsApp API infrastructure</small></span></div>
      <p>Use RelayWA for legitimate, consent-based messaging and follow applicable WhatsApp policies.</p>
    </footer>
  </main>;
}
