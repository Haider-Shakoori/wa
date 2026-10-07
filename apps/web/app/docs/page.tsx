'use client';

import { useMemo, useState } from 'react';

const API_BASE = 'https://api.relaywa.com/api';
const languages = ['cURL','JavaScript','Laravel / PHP','Python','C# / .NET'] as const;
type Language = typeof languages[number];

const snippets:Record<Language,string> = {
  'cURL': [
    "curl -X POST 'https://api.relaywa.com/api/v1/sessions/YOUR_SESSION_ID/messages/text' \\",
    "  -H 'Authorization: Bearer rw_live_YOUR_KEY' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '{",
    '    "to": "E164_RECIPIENT_NUMBER",',
    '    "text": "Your order is ready.",',
    '    "clientMessageId": "order-1001"',
    "  }'"
  ].join('\n'),
  'JavaScript': [
    'const response = await fetch(',
    '  "https://api.relaywa.com/api/v1/sessions/YOUR_SESSION_ID/messages/text",',
    '  {',
    '    method: "POST",',
    '    headers: {',
    '      Authorization: "Bearer " + process.env.RELAYWA_API_KEY,',
    '      "Content-Type": "application/json"',
    '    },',
    '    body: JSON.stringify({',
    '      to: "E164_RECIPIENT_NUMBER",',
    '      text: "Your order is ready.",',
    '      clientMessageId: "order-1001"',
    '    })',
    '  }',
    ');',
    '',
    'const message = await response.json();'
  ].join('\n'),
  'Laravel / PHP': [
    'use Illuminate\\Support\\Facades\\Http;',
    '',
    "$message = Http::withToken(env('RELAYWA_API_KEY'))",
    "    ->post('https://api.relaywa.com/api/v1/sessions/YOUR_SESSION_ID/messages/text', [",
    "        'to' => 'E164_RECIPIENT_NUMBER',",
    "        'text' => 'Your order is ready.',",
    "        'clientMessageId' => 'order-1001',",
    '    ])',
    '    ->throw()',
    '    ->json();'
  ].join('\n'),
  'Python': [
    'import os',
    'import requests',
    '',
    'response = requests.post(',
    '    "https://api.relaywa.com/api/v1/sessions/YOUR_SESSION_ID/messages/text",',
    '    headers={"Authorization": "Bearer " + os.environ["RELAYWA_API_KEY"]},',
    '    json={',
    '        "to": "E164_RECIPIENT_NUMBER",',
    '        "text": "Your order is ready.",',
    '        "clientMessageId": "order-1001"',
    '    },',
    ')',
    'response.raise_for_status()'
  ].join('\n'),
  'C# / .NET': [
    'using System.Net.Http.Headers;',
    '',
    'var client = new HttpClient();',
    'client.DefaultRequestHeaders.Authorization =',
    '    new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("RELAYWA_API_KEY"));',
    '',
    'var response = await client.PostAsJsonAsync(',
    '    "https://api.relaywa.com/api/v1/sessions/YOUR_SESSION_ID/messages/text",',
    '    new { to = "E164_RECIPIENT_NUMBER", text = "Your order is ready.", clientMessageId = "order-1001" });',
    '',
    'response.EnsureSuccessStatusCode();'
  ].join('\n')
};

const sessionEndpoints = [
  ['GET','/v1/sessions','sessions.read','List workspace sessions'],
  ['GET','/v1/sessions/:sessionId','sessions.read','Get one session'],
  ['GET','/v1/sessions/:sessionId/qr','sessions.read','Read current QR state'],
  ['GET','/v1/sessions/:sessionId/events','sessions.read','Server-sent session events'],
  ['POST','/v1/sessions','Dashboard user','Create a session'],
  ['POST','/v1/sessions/:sessionId/connect','Dashboard user','Request connection'],
  ['POST','/v1/sessions/:sessionId/restart','Dashboard user','Restart session'],
  ['POST','/v1/sessions/:sessionId/logout','Dashboard user','Log out linked device']
];

const messageEndpoints = [
  ['GET','/v1/sessions/:sessionId/messages','messages.read','Latest 100 messages'],
  ['GET','/v1/sessions/:sessionId/messages/:messageId','messages.read','Get message state'],
  ['POST','/v1/sessions/:sessionId/messages/text','messages.send','Text message'],
  ['POST','/v1/sessions/:sessionId/messages/image','messages.send','Image'],
  ['POST','/v1/sessions/:sessionId/messages/video','messages.send','Video'],
  ['POST','/v1/sessions/:sessionId/messages/audio','messages.send','Audio / voice note'],
  ['POST','/v1/sessions/:sessionId/messages/document','messages.send','Document'],
  ['POST','/v1/sessions/:sessionId/messages/reply','messages.send','Reply to a message'],
  ['POST','/v1/sessions/:sessionId/messages/reaction','messages.send','Reaction'],
  ['POST','/v1/sessions/:sessionId/messages/location','messages.send','Location'],
  ['POST','/v1/sessions/:sessionId/messages/contact','messages.send','vCard contact'],
  ['POST','/v1/sessions/:sessionId/messages/poll','messages.send','Poll']
];

export default function DocsPage() {
  const [language,setLanguage] = useState<Language>('cURL');
  const snippet = useMemo(()=>snippets[language],[language]);

  return <main className="docs-site">
    <header className="public-nav docs-topbar">
      <a className="public-brand" href="/"><span className="brand-mark">rW</span><span><strong>RelayWA</strong><small>Developer documentation</small></span></a>
      <nav><a href="/">Home</a><a href="/#pricing">Pricing</a><a href="https://app.relaywa.com/login">Sign in</a><a className="public-cta" href="https://app.relaywa.com/login">Start free</a></nav>
    </header>

    <div className="docs-layout">
      <aside className="docs-sidebar">
        <div className="docs-side-title"><strong>Documentation</strong><span>API v1</span></div>
        <nav>
          <a href="#overview">Overview</a><a href="#quickstart">Quickstart</a><a href="#authentication">Authentication</a>
          <a href="#sessions">Sessions</a><a href="#messages">Messages</a><a href="#media-actions">Media & actions</a>
          <a href="#scheduling">Queue & scheduling</a><a href="#webhooks">Webhooks</a><a href="#errors">Errors</a><a href="#safety">Safety Governor</a>
        </nav>
        <div className="docs-side-card"><span className="live-dot"/><div><strong>Production API</strong><small>{API_BASE}</small></div></div>
      </aside>

      <article className="docs-content">
        <section className="docs-hero" id="overview">
          <span className="public-kicker">RelayWA API v1</span>
          <h1>Build WhatsApp messaging into your application.</h1>
          <p>Send messages, read delivery state, receive real-time events and operate multiple linked WhatsApp sessions from your own backend.</p>
          <div className="docs-base-url"><span>Base URL</span><code>{API_BASE}</code><button onClick={()=>void navigator.clipboard.writeText(API_BASE)}>Copy</button></div>
          <div className="docs-note"><strong>Backend only</strong><p>Keep RelayWA API keys on your server. Do not embed them in public browser JavaScript or mobile application binaries.</p></div>
        </section>

        <DocSection id="quickstart" eyebrow="Start here" title="Quickstart">
          <div className="docs-step-grid">
            <Step number="01" title="Create your workspace">Start a trial or paid workspace and complete tenant onboarding.</Step>
            <Step number="02" title="Connect WhatsApp">Create a session and scan its QR code from WhatsApp → Linked devices.</Step>
            <Step number="03" title="Create an API key">Open Developers in the tenant workspace and create an organization or session-bound key with <code>messages.send</code>.</Step>
            <Step number="04" title="Send a message">Call the session message endpoint from your server and use <code>clientMessageId</code> for idempotency.</Step>
          </div>
          <div className="docs-code-card">
            <div className="docs-code-head"><strong>Send your first text message</strong><div className="docs-code-tabs">{languages.map(item=><button key={item} className={language===item?'active':''} onClick={()=>setLanguage(item)}>{item}</button>)}</div></div>
            <pre><code>{snippet}</code></pre>
            <div className="docs-code-foot"><span>Immediate sends require the selected WhatsApp session to be connected.</span><button onClick={()=>void navigator.clipboard.writeText(snippet)}>Copy example</button></div>
          </div>
        </DocSection>

        <DocSection id="authentication" eyebrow="Security" title="Authentication">
          <p>Send your API key as a Bearer token on every API request.</p>
          <Code value={'Authorization: Bearer rw_live_YOUR_KEY'}/>
          <div className="docs-two">
            <InfoCard title="Organization key"><p>Starts with <code>rw_live_</code>. It may access sessions in the organization when its scopes allow the requested operation.</p></InfoCard>
            <InfoCard title="Session-bound key"><p>Starts with <code>rw_session_</code>. It is restricted to one session and cannot access organization-wide resources that lack a session route parameter.</p></InfoCard>
          </div>
          <h3>Available API scopes</h3>
          <div className="scope-doc-grid">{['sessions.read','messages.read','messages.send','contacts.read','chats.read','groups.read','webhooks.read'].map(scope=><code key={scope}>{scope}</code>)}</div>
          <div className="docs-note neutral"><strong>Management operations</strong><p>Creating API keys, changing session lifecycle, and creating/updating/removing webhook endpoints are dashboard-user operations. API keys remain deliberately limited to integration-safe scopes.</p></div>
        </DocSection>

        <DocSection id="sessions" eyebrow="WhatsApp connections" title="Sessions">
          <p>A session represents one linked WhatsApp account. Integrations typically read session state with an API key, while connection lifecycle changes are performed from the tenant workspace.</p>
          <EndpointTable rows={sessionEndpoints}/>
          <h3>Typical session states</h3>
          <div className="docs-chip-row">{['pending','connecting','need_scan','connected','reconnecting','disconnected','logged_out','error'].map(v=><span key={v}>{v}</span>)}</div>
        </DocSection>

        <DocSection id="messages" eyebrow="Outbound API" title="Messages">
          <p>Outbound endpoints are scoped to a session. RelayWA queues accepted messages and returns the stored message record, which can be queried later for status.</p>
          <EndpointTable rows={messageEndpoints}/>
          <h3>Text request</h3>
          <Code value={['{','  "to": "E164_RECIPIENT_NUMBER",','  "text": "Your order is ready.",','  "clientMessageId": "order-1001",','  "priority": 5,','  "maxAttempts": 5','}'].join('\n')}/>
          <div className="docs-field-grid">
            <Field name="to" required>International E.164 number (country code + subscriber number, digits only) or a supported WhatsApp recipient identifier. Phone strings are 7–32 characters.</Field>
            <Field name="text" required>Message body, 1–4096 characters.</Field>
            <Field name="clientMessageId">Idempotency key up to 120 characters. Reusing it for the same organization/session returns the existing message.</Field>
            <Field name="scheduledAt">ISO date/time for future delivery.</Field>
            <Field name="priority">Integer 1–10. Default 5.</Field>
            <Field name="maxAttempts">Integer 1–10. Default 5 and still bounded by platform safety settings.</Field>
          </div>
        </DocSection>

        <DocSection id="media-actions" eyebrow="Rich messaging" title="Media & actions">
          <h3>Media payload</h3>
          <Code value={['POST /v1/sessions/:sessionId/messages/image','', '{','  "to": "E164_RECIPIENT_NUMBER",','  "url": "https://cdn.example.com/invoice.jpg",','  "mimeType": "image/jpeg",','  "mediaSizeBytes": 245820,','  "caption": "Your invoice",','  "clientMessageId": "invoice-1001"','}'].join('\n')}/>
          <p>Media URLs must use HTTPS and must not point to private-network addresses. RelayWA validates the declared MIME type and size before queuing.</p>
          <div className="media-limit-grid">
            <InfoCard title="Images"><strong>16 MB</strong><p>Image MIME types.</p></InfoCard>
            <InfoCard title="Video"><strong>64 MB</strong><p>Video MIME types.</p></InfoCard>
            <InfoCard title="Audio"><strong>16 MB</strong><p>Audio MIME types. <code>voiceNote: true</code> is valid only for audio.</p></InfoCard>
            <InfoCard title="Documents"><strong>100 MB</strong><p>Application, text, image, audio and video document MIME types.</p></InfoCard>
          </div>
          <p>Reply, reaction, location, contact and poll endpoints use the same recipient, scheduling, priority, retry and idempotency controls as standard messages.</p>
        </DocSection>

        <DocSection id="scheduling" eyebrow="Dispatch controls" title="Queue & scheduling">
          <div className="docs-two">
            <InfoCard title="Immediate delivery"><p>Without a future <code>scheduledAt</code>, the WhatsApp session must already be connected. Otherwise RelayWA returns HTTP 409.</p></InfoCard>
            <InfoCard title="Scheduled delivery"><p>Set an ISO <code>scheduledAt</code> in the future. RelayWA stores the message as scheduled and makes it eligible at that time.</p></InfoCard>
          </div>
          <p>Accepted messages still pass through platform pacing, burst limits and safety controls, so WhatsApp delivery may occur after the API request returns.</p>
        </DocSection>

        <DocSection id="webhooks" eyebrow="Real-time events" title="Webhooks">
          <p>Create webhook endpoints from the tenant workspace. RelayWA sends HTTPS POST requests for subscribed session events. The webhook secret is returned when the endpoint is created and encrypted at rest afterwards.</p>
          <h3>Delivery body</h3>
          <Code value={['{','  "id": "EVENT_ID",','  "type": "message.received",','  "sessionId": "SESSION_ID",','  "createdAt": "2026-10-07T12:00:00.000Z",','  "data": {}','}'].join('\n')}/>
          <h3>Signature headers</h3>
          <Code value={['x-relaywa-event: message.received','x-relaywa-event-id: EVENT_ID','x-relaywa-timestamp: 1791378000','x-relaywa-signature: sha256=...'].join('\n')}/>
          <h3>Node.js verification</h3>
          <Code value={['import crypto from "node:crypto";','','const expected = "sha256=" + crypto','  .createHmac("sha256", secret)','  .update(timestamp + "." + rawBody)','  .digest("hex");','','const valid = crypto.timingSafeEqual(','  Buffer.from(expected),','  Buffer.from(signature)',');'].join('\n')}/>
          <div className="docs-note neutral"><strong>Signature input</strong><p>The HMAC-SHA256 input is <code>timestamp + "." + rawBody</code>. Verify the exact raw request body before JSON parsing.</p></div>
          <EndpointTable rows={[
            ['GET','/v1/webhooks','webhooks.read','List endpoints'],
            ['GET','/v1/webhooks/:endpointId/deliveries','webhooks.read','Inspect recent delivery attempts'],
            ['POST','/v1/webhooks','Dashboard user','Create endpoint'],
            ['PATCH','/v1/webhooks/:endpointId','Dashboard user','Update endpoint'],
            ['DELETE','/v1/webhooks/:endpointId','Dashboard user','Delete endpoint']
          ]}/>
        </DocSection>

        <DocSection id="errors" eyebrow="HTTP behavior" title="Errors">
          <div className="error-doc-grid">
            <InfoCard title="400 Bad Request"><p>Validation failed, media policy rejected input, or unsupported fields were submitted.</p></InfoCard>
            <InfoCard title="401 Unauthorized"><p>Missing, invalid, expired or revoked bearer token.</p></InfoCard>
            <InfoCard title="403 Forbidden"><p>Missing scope, wrong session binding, or an operation that requires dashboard authentication.</p></InfoCard>
            <InfoCard title="404 Not Found"><p>The requested resource does not exist inside the authenticated organization.</p></InfoCard>
            <InfoCard title="409 Conflict"><p>Examples include an immediate send while the session is disconnected or an invalid action combination.</p></InfoCard>
          </div>
          <Code value={['{','  "statusCode": 409,','  "message": "WhatsApp session is not connected",','  "error": "Conflict"','}'].join('\n')}/>
        </DocSection>

        <DocSection id="safety" eyebrow="Responsible delivery" title="Safety Governor">
          <p>RelayWA applies platform-level safeguards independently of your subscription allowance: randomized pacing, burst/minute/hour ceilings, duplicate suppression, bounded retries, maximum queue age and automatic session pauses after repeated final failures.</p>
          <div className="docs-note warning"><strong>Important</strong><p>Baileys and Chromium are unofficial WhatsApp Web transports. Safety controls reduce operational risk but cannot guarantee that WhatsApp will never restrict an account. Use consent-based messaging and avoid abusive or cold bulk sending.</p></div>
        </DocSection>

        <section className="docs-cta"><div><span className="public-kicker">Ready to integrate?</span><h2>Connect a number and send your first API message.</h2><p>Start with the free trial, create a scoped API key and test the examples above.</p></div><a className="primary-button" href="https://app.relaywa.com/login">Start 7-day trial</a></section>
      </article>
    </div>
  </main>;
}

function DocSection({id,eyebrow,title,children}:{id:string;eyebrow:string;title:string;children:React.ReactNode}) {
  return <section className="docs-section" id={id}><div className="docs-section-head"><span className="public-kicker">{eyebrow}</span><h2>{title}</h2></div>{children}</section>;
}
function Step({number,title,children}:{number:string;title:string;children:React.ReactNode}) {
  return <div className="docs-step"><span>{number}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}
function InfoCard({title,children}:{title:string;children:React.ReactNode}) {
  return <div className="docs-info-card"><h4>{title}</h4>{children}</div>;
}
function Field({name,required=false,children}:{name:string;required?:boolean;children:React.ReactNode}) {
  return <div className="docs-field"><div><code>{name}</code>{required && <span>required</span>}</div><p>{children}</p></div>;
}
function Code({value}:{value:string}) {
  return <pre className="docs-code"><code>{value}</code></pre>;
}
function EndpointTable({rows}:{rows:string[][]}) {
  return <div className="docs-endpoints"><div className="docs-endpoint-row head"><span>Method</span><span>Endpoint</span><span>Access</span><span>Description</span></div>{rows.map(([method,path,scope,description])=><div className="docs-endpoint-row" key={method+path}><span className={'method method-' + method.toLowerCase()}>{method}</span><code>{path}</code><span>{scope}</span><span>{description}</span></div>)}</div>;
}
