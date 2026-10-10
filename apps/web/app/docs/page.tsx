'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import './docs-theme.css';
import { FeatherIcon } from '../../components/feather-icon';
import CodeShowcase from '../../components/code-showcase';
import { integrationExamples } from '../../lib/integration-examples';
import { Brand } from '../../components/marketing-primitives';

import { API_BASE } from '../../lib/api';

const navGroups: Array<{label:string;items:Array<[string,string]>}> = [
  {
    label:'Getting started',
    items:[
      ['overview','Overview'],
      ['quickstart','Quickstart'],
      ['authentication','Authentication'],
      ['language-examples','Languages & frameworks'],
      ['api-keys','API keys & scopes'],
    ],
  },
  {
    label:'WhatsApp',
    items:[
      ['sessions','Sessions & QR'],
      ['messages','Send messages'],
      ['media-actions','Media & actions'],
      ['directory','Contacts, chats & groups'],
    ],
  },
  {
    label:'Delivery',
    items:[
      ['queue','Direct sending & retries'],
      ['webhooks','Webhooks'],
      ['safety','Application responsibilities'],
      ['errors','Errors & status'],
    ],
  },
  {
    label:'Operations',
    items:[
      ['engines','Baileys vs Chromium'],
      ['troubleshooting','Troubleshooting'],
      ['production','Production checklist'],
    ],
  },
];

const docsIndex = navGroups.flatMap((group)=>group.items.map(([id,title])=>({
  id,title,group:group.label,
  keywords:(title + ' ' + group.label).toLowerCase(),
})));

const sessionEndpoints = [
  ['GET','/whatsapp-sessions','sessions.read','List workspace sessions'],
  ['GET','/whatsapp-sessions/:sessionId','sessions.read','Read one session'],
  ['GET','/whatsapp-sessions/:sessionId/qrcode','sessions.read','Read QR availability / data'],
  ['GET','/whatsapp-sessions/:sessionId/events','sessions.read','Server-sent session events'],
  ['POST','/whatsapp-sessions','sessions.manage','Create a session'],
  ['PATCH','/whatsapp-sessions/:sessionId','sessions.manage','Update session name or phone hint'],
  ['DELETE','/whatsapp-sessions/:sessionId','sessions.manage','Delete an unlinked or logged-out session'],
  ['GET','/whatsapp-sessions/:sessionId/logs','sessions.read','Read connection event history'],
  ['POST','/whatsapp-sessions/:sessionId/connect','sessions.manage','Start or resume pairing'],
  ['POST','/whatsapp-sessions/:sessionId/restart','sessions.manage','Restart runtime without logout'],
  ['POST','/whatsapp-sessions/:sessionId/disconnect','sessions.manage','Log out linked WhatsApp'],
];

const messageEndpoints = [
  ['GET','/whatsapp-sessions/:sessionId/messages','messages.read','List recent messages'],
  ['GET','/whatsapp-sessions/:sessionId/messages/:messageId','messages.read','Read message state'],
  ['POST','/send-message','messages.send','Send text'],
  ['POST','/send-image','messages.send','Send image'],
  ['POST','/send-video','messages.send','Send video'],
  ['POST','/send-audio','messages.send','Send audio / voice note'],
  ['POST','/send-document','messages.send','Send document'],
  ['POST','/send-reply','messages.send','Reply to a message'],
  ['POST','/send-reaction','messages.send','Send reaction'],
  ['POST','/send-location','messages.send','Send location'],
  ['POST','/send-contact','messages.send','Send vCard contact'],
  ['POST','/send-poll','messages.send','Send poll'],
];

const directoryEndpoints = [
  ['GET','/whatsapp-sessions/:sessionId/contacts','contacts.read','Read synchronized contacts'],
  ['GET','/whatsapp-sessions/:sessionId/chats','chats.read','Read synchronized chats'],
  ['GET','/whatsapp-sessions/:sessionId/groups','groups.read','Read synchronized groups'],
];

const webhookEndpoints = [
  ['GET','/webhooks','webhooks.read','List webhook endpoints'],
  ['GET','/webhooks/:endpointId/deliveries','webhooks.read','Inspect last 100 deliveries'],
  ['POST','/webhooks','webhooks.manage','Create webhook endpoint'],
  ['PATCH','/webhooks/:endpointId','webhooks.manage','Update endpoint'],
  ['DELETE','/webhooks/:endpointId','webhooks.manage','Delete endpoint'],
];

const languages = ['cURL','JavaScript','Laravel / PHP','Python','C# / .NET'] as const;
type Language = typeof languages[number];

function buildSnippet(language:Language) {
  const endpoint = API_BASE + '/send-message';
  if (language === 'JavaScript') return `const response = await fetch(
  "${endpoint}",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RELAYWA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: "E164_RECIPIENT_NUMBER",
      text: "Your order is ready.",
      clientMessageId: "order-1001"
    })
  }
);

const message = await response.json();`;

  if (language === 'Laravel / PHP') return `use Illuminate\\Support\\Facades\\Http;

$message = Http::withToken(env('RELAYWA_API_KEY'))
    ->post('${endpoint}', [
        'to' => 'E164_RECIPIENT_NUMBER',
        'text' => 'Your order is ready.',
        'clientMessageId' => 'order-1001',
    ])
    ->throw()
    ->json();`;

  if (language === 'Python') return `import os
import requests

response = requests.post(
    "${endpoint}",
    headers={"Authorization": "Bearer " + os.environ["RELAYWA_API_KEY"]},
    json={
        "to": "E164_RECIPIENT_NUMBER",
        "text": "Your order is ready.",
        "clientMessageId": "order-1001"
    },
)
response.raise_for_status()`;

  if (language === 'C# / .NET') return `using System.Net.Http.Headers;

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue(
        "Bearer",
        Environment.GetEnvironmentVariable("RELAYWA_API_KEY")
    );

var response = await client.PostAsJsonAsync(
    "${endpoint}",
    new {
        to = "E164_RECIPIENT_NUMBER",
        text = "Your order is ready.",
        clientMessageId = "order-1001"
    });

response.EnsureSuccessStatusCode();`;

  return `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer rw_session_YOUR_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "to": "E164_RECIPIENT_NUMBER",
    "text": "Your order is ready.",
    "clientMessageId": "order-1001"
  }'`;
}

export default function DocsPage() {
  const [query,setQuery]=useState('');
  const [navigationOpen,setNavigationOpen]=useState(false);
  const articleRef=useRef<HTMLElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const [contentIndex,setContentIndex]=useState<Array<{id:string;title:string;group:string;text:string}>>([]);
  useEffect(()=>{
    setContentIndex(docsIndex.map(item=>{
      const section=articleRef.current?.querySelector<HTMLElement>('#'+item.id);
      const extra=item.id==='language-examples'?Object.entries(integrationExamples).map(([name,code])=>name+' '+code).join(' '):item.id==='quickstart'?languages.map(name=>name+' '+buildSnippet(name)).join(' '):'';
      return {...item,text:((section?.innerText||'')+' '+extra).replace(/\s+/g,' ').trim()};
    }));
  },[]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchRef.current?.focus();}if(event.key==='Escape'){setQuery('');searchRef.current?.blur();}};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[]);
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{
    const refresh=()=>setSignedIn(Boolean(window.localStorage.getItem('relaywa_access_token')));
    refresh();window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);
    return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);};
  },[]);
  const [language,setLanguage]=useState<Language>('cURL');
  const snippet=useMemo(()=>buildSnippet(language),[language]);
  const searchResults=useMemo(()=>{
    const clean=query.trim().toLowerCase();
    if (!clean) return [];
    const terms=clean.split(/\s+/);
    return contentIndex.filter(item=>terms.every(term=>(item.title+' '+item.group+' '+item.text).toLowerCase().includes(term))).map(item=>{
      const position=item.text.toLowerCase().indexOf(terms[0]);
      const start=Math.max(0,position-45);
      return {...item,excerpt:(start?'…':'')+item.text.slice(start,start+170)+'…'};
    });
  },[query,contentIndex]);

  return <main className="docs-v2 rw-docs" id="main-content">
    <header className="docs-v2-topbar">
      <Brand/>
      <div className="docs-search"><FeatherIcon name="search" size={17}/><input ref={searchRef} aria-label="Search all documentation" aria-controls="docs-search-results" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search endpoints, guides, and code…"/>{query?<button type="button" onClick={()=>{setQuery('');searchRef.current?.focus();}} aria-label="Clear search">×</button>:<kbd>Ctrl K</kbd>}</div>
      <nav><a href="/">Product</a><a href="/#pricing">Pricing</a>{signedIn?<a className="public-cta" href="/dashboard">Back to dashboard</a>:<><a href="/login">Sign in</a><a className="public-cta" href="/register">Start free</a></>}</nav>
    </header>

    <div className="docs-v2-layout">
      <aside className={"docs-v2-sidebar"+(navigationOpen?" navigation-open":"")+(query?" has-search":"")}><button type="button" className="docs-mobile-nav" aria-expanded={navigationOpen} onClick={()=>setNavigationOpen(!navigationOpen)}><FeatherIcon name="menu" size={16}/> Browse documentation <span>{navigationOpen?"−":"+"}</span></button>
        <div className="docs-v2-title"><strong>API Documentation</strong><span>RelayWA API</span></div>


        {query ? <div className="docs-search-results" id="docs-search-results">
          <small role="status" aria-live="polite">{searchResults.length} result{searchResults.length===1?'':'s'}</small>
          {searchResults.map((item)=><a key={item.id} href={'#'+item.id} onClick={()=>setQuery('')}><strong>{item.title}</strong><span>{item.group}</span><p>{item.excerpt}</p></a>)}
          {!searchResults.length && <p>No matching topic. Try “webhook”, “session”, “media” or “retry”.</p>}
        </div> :
        <nav className="docs-nav-groups">
          {navGroups.map((group)=><div className="docs-nav-group" key={group.label}><span>{group.label}</span>{group.items.map(([id,title])=><a key={id} href={'#'+id} onClick={()=>setNavigationOpen(false)}>{title}</a>)}</div>)}
        </nav>}

        <div className="docs-api-status"><span className="live-dot"/><div><strong>API endpoint</strong><code>{API_BASE}</code></div></div>
      </aside>

      <article ref={articleRef} className="docs-v2-content">
        <section className="docs-v2-hero" id="overview">
          <span className="public-kicker">RelayWA API</span>
          <h1>Build reliable WhatsApp messaging into your product.</h1>
          <p>Everything needed to connect sessions, send and track messages, receive inbound events, manage webhooks, understand direct sending and operate RelayWA safely.</p>
          <div className="docs-base-url"><span>Base URL</span><code>{API_BASE}</code><button onClick={()=>void navigator.clipboard.writeText(API_BASE)}>Copy</button></div>
          <div className="docs-hero-cards">
            <InfoCard title="REST API"><strong>JSON over HTTPS</strong><p>Use scoped Bearer credentials from your backend.</p></InfoCard>
            <InfoCard title="Realtime"><strong>SSE + webhooks</strong><p>Watch session events and receive outbound callbacks.</p></InfoCard>
            <InfoCard title="Multi-session"><strong>One API, many numbers</strong><p>Route each send through a specific WhatsApp session.</p></InfoCard>
          </div>
        </section>

        <DocSection id="quickstart" eyebrow="Getting started" title="Quickstart" intro="The shortest path from account creation to your first WhatsApp message.">
          <div className="docs-step-grid">
            <Step number="01" title="Create a workspace">Start the 7-day trial or choose a paid plan, then finish workspace setup.</Step>
            <Step number="02" title="Connect WhatsApp">Create a session, scan the QR from WhatsApp → Linked devices and wait for <code>connected</code>.</Step>
            <Step number="03" title="Copy your session key">Open View API key after connecting. Your session key is created automatically and includes <code>messages.send</code>.</Step>
            <Step number="04" title="Send from your backend">Call /api/send-message with your session key and store the RelayWA message ID for status checks.</Step>
          </div>

          <div className="docs-code-card">
            <div className="docs-code-head"><strong>Send your first message</strong><div role="group" aria-label="Code example language">{languages.map((item)=><button type="button" aria-pressed={language===item} key={item} className={language===item?'active':''} onClick={()=>setLanguage(item)}>{item}</button>)}</div></div>
            <pre><code>{snippet}</code></pre>
            <div className="docs-code-foot"><span>Replace your session API key and <code>E164_RECIPIENT_NUMBER</code>.</span><button onClick={()=>void navigator.clipboard.writeText(snippet)}>Copy example</button></div>
          </div>
        </DocSection>

        <DocSection id="authentication" eyebrow="Security" title="Authentication" intro="API requests use Bearer credentials. Keep them server-side and rotate/revoke them when an integration changes ownership.">
          <Code value={'Authorization: Bearer rw_session_YOUR_KEY'}/>
          <div className="docs-two">
            <InfoCard title="Organization key"><p>Can operate across sessions in its organization when the key has the required scope.</p></InfoCard>
            <InfoCard title="Session-bound key"><p>Starts with <code>rw_session_</code> and restricts the credential to one WhatsApp session for tighter isolation.</p></InfoCard>
          </div>
          <Note title="Never expose API keys">Do not embed RelayWA keys in browser JavaScript or distributable mobile binaries. Send from your own backend.</Note>
        </DocSection>

        <DocSection id="api-keys" eyebrow="Access control" title="API keys & scopes" intro="Dashboard users create and revoke keys. API access is then limited by scopes and, for session tokens, by the bound session.">
          <div className="scope-doc-grid">{['sessions.read','sessions.manage','messages.read','messages.send','contacts.read','chats.read','groups.read','webhooks.read','webhooks.manage'].map((scope)=><code key={scope}>{scope}</code>)}</div>
          <div className="docs-two">
            <InfoCard title="Dashboard-only management"><p>Creating/revoking API keys and changing session lifecycle requires authenticated dashboard permissions.</p></InfoCard>
            <InfoCard title="Least privilege"><p>Give integrations only the scopes they need. A reporting service usually does not need <code>messages.send</code>.</p></InfoCard>
          </div>
        </DocSection>

        <DocSection id="sessions" eyebrow="WhatsApp connections" title="Sessions & QR lifecycle" intro="A session represents one linked WhatsApp account and owns its runtime, message routing and connection state.">
          <EndpointTable rows={sessionEndpoints}/>
          <h3>Session states</h3>
          <div className="docs-chip-row">{['pending','connecting','need_scan','connected','reconnecting','disconnected','logged_out','error'].map((state)=><span key={state}>{state}</span>)}</div>
          <div className="docs-three">
            <InfoCard title="need_scan"><p>A QR is available or pairing is required. Read <code>/qr</code> and display it to the authorized user.</p></InfoCard>
            <InfoCard title="reconnecting"><p>The worker is trying to restore the current authenticated session. Avoid forcing logout.</p></InfoCard>
            <InfoCard title="logged_out"><p>The linked WhatsApp account is no longer authenticated and needs a new QR pairing.</p></InfoCard>
          </div>
        </DocSection>

        <DocSection id="messages" eyebrow="Outbound messaging" title="Send messages" intro="Outbound requests are dispatched immediately. A successful send means WhatsApp transport acceptance; recipient delivery confirmation is a separate status update.">
          <EndpointTable rows={messageEndpoints}/>
          <h3>Text payload</h3>
          <Code value={['{','  "to": "E164_RECIPIENT_NUMBER",','  "text": "Your order is ready.",','  "clientMessageId": "order-1001"','}'].join('\n')}/>
          <div className="docs-field-grid">
            <Field name="to" required>E.164 international number, digits only, or another supported WhatsApp recipient identifier. Length 7–32.</Field>
            <Field name="text" required>Message body from 1 to 4096 characters.</Field>
            <Field name="clientMessageId">Your idempotency key, up to 120 characters. Reuse prevents accidental duplicate creation.</Field>



          </div>
        </DocSection>

        <DocSection id="media-actions" eyebrow="Rich messaging" title="Media & actions" intro="Media and interaction endpoints use the same recipient and idempotency validation as text messages.">
          <h3>Media payload</h3>
          <Code value={['{','  "to": "E164_RECIPIENT_NUMBER",','  "url": "https://cdn.example.com/invoice.pdf",','  "mimeType": "application/pdf",','  "mediaSizeBytes": 245820,','  "fileName": "invoice.pdf",','  "caption": "Your invoice",','  "clientMessageId": "invoice-1001"','}'].join('\n')}/>
          <div className="media-limit-grid">
            <InfoCard title="Images"><strong>16 MB</strong><p>Image MIME types.</p></InfoCard>
            <InfoCard title="Video"><strong>64 MB</strong><p>Video MIME types.</p></InfoCard>
            <InfoCard title="Audio"><strong>16 MB</strong><p>Set <code>voiceNote: true</code> only for audio.</p></InfoCard>
            <InfoCard title="Documents"><strong>100 MB</strong><p>Document and supported media MIME types.</p></InfoCard>
          </div>
          <Note title="Transfer checks & cleanup">Downloaded bytes must match mediaSizeBytes and stay within the file limit. The worker checks the supplied content type, sends media from memory, then clears temporary buffers after every attempt. RelayWA does not retain an outbound file copy or delete files from your source hosting. These checks do not include malware scanning.</Note>
          <h3>Action payload requirements</h3>
          <div className="docs-field-grid">
            <Field name="reply">Requires <code>quotedMessageId</code> and message text.</Field>
            <Field name="reaction">Requires <code>targetMessageId</code> and an emoji.</Field>
            <Field name="location">Requires valid latitude/longitude; name and address are optional.</Field>
            <Field name="contact">Requires display name and vCard content.</Field>
            <Field name="poll">2–12 options with <code>selectableCount</code> between 1 and 12.</Field>
          </div>
        </DocSection>

        <DocSection id="directory" eyebrow="Read APIs" title="Contacts, chats & groups" intro="Directory endpoints expose synchronized WhatsApp context for the selected session.">
          <EndpointTable rows={directoryEndpoints}/>
          <Note title="Scope isolation">A session-bound key can only read directory data for its bound session. Organization keys still need the matching read scope.</Note>
        </DocSection>

        <DocSection id="queue" eyebrow="Direct dispatch" title="Immediate sending & application jobs" intro="RelayWA sends each request directly to the connected WhatsApp runtime. There is no outbound Redis queue, randomized gap, or automatic retry.">
          <div className="docs-two"><InfoCard title="Immediate result"><p>A successful send response includes the message record after transport acceptance. Recipient delivery and read receipts arrive later through status updates and webhooks.</p></InfoCard><InfoCard title="Your application's jobs"><p>Use Laravel Jobs or your own job system for scheduling, throttling, backoff, and retries. RelayWA rejects scheduledAt, priority, and maxAttempts.</p></InfoCard></div>
          <Note title="Avoid duplicate sends">Use clientMessageId for idempotency. If a request times out, check its message ID or repeat the same idempotency key to inspect the existing result before deciding to send again. A timeout can have an unknown delivery outcome.</Note>
        </DocSection>

        <DocSection id="webhooks" eyebrow="Realtime delivery" title="Webhooks" intro="Webhook endpoints receive signed HTTPS POST callbacks for subscribed RelayWA session events.">
          <EndpointTable rows={webhookEndpoints}/>
          <h3>Delivery body</h3>
          <Code value={['{','  "id": "EVENT_ID",','  "type": "message.received",','  "sessionId": "SESSION_ID",','  "createdAt": "2026-10-07T12:00:00.000Z",','  "data": {}','}'].join('\n')}/>
          <h3>Signature headers</h3>
          <Code value={['x-relaywa-event: message.received','x-relaywa-event-id: EVENT_ID','x-relaywa-timestamp: 1791378000','x-relaywa-signature: sha256=...'].join('\n')}/>
          <h3>Verify HMAC-SHA256</h3>
          <Code value={['import crypto from "node:crypto";','','const expected = "sha256=" + crypto','  .createHmac("sha256", secret)','  .update(timestamp + "." + rawBody)','  .digest("hex");'].join('\n')}/>
          <Note title="Use the raw body">Verify the exact raw request bytes before JSON parsing. RelayWA signs <code>timestamp + "." + rawBody</code>.</Note>
          <Note title="Public HTTPS only">Webhook URLs must use HTTPS. RelayWA blocks localhost and private-network IP ranges.</Note>
        </DocSection>

        <DocSection id="safety" eyebrow="Application controls" title="Pacing belongs in your application" intro="Configure the sending cadence, scheduling, retry policy, and duplicate-business-event handling in your own application.">
          <Note title="API checks remain">RelayWA still authenticates requests, enforces scopes and subscription quotas, validates recipients and media, and requires a connected session. It does not add a platform sending delay.</Note>
        </DocSection>

        <DocSection id="errors" eyebrow="HTTP behavior" title="Errors & message status" intro="Use HTTP status codes for request-level failures and message status for asynchronous delivery state.">
          <div className="error-doc-grid">
            <InfoCard title="400 Bad Request"><p>Payload validation or media policy failed.</p></InfoCard>
            <InfoCard title="401 Unauthorized"><p>Missing, invalid, expired or revoked credential.</p></InfoCard>
            <InfoCard title="403 Forbidden"><p>Missing scope, wrong session binding or insufficient dashboard permission.</p></InfoCard>
            <InfoCard title="404 Not Found"><p>Resource does not exist inside the authenticated organization.</p></InfoCard>
            <InfoCard title="409 Conflict"><p>Example: immediate send attempted while the session is not connected.</p></InfoCard>
          </div>
          <Code value={['{','  "statusCode": 409,','  "message": "WhatsApp session is not connected",','  "error": "Conflict"','}'].join('\n')}/>
        </DocSection>

        <DocSection id="engines" eyebrow="Messaging runtime" title="Baileys vs Chromium" intro="RelayWA supports two WhatsApp Web transports with different resource and compatibility profiles.">
          <div className="docs-two">
            <InfoCard title="Baileys"><strong>Lightweight / scalable</strong><p>WebSocket protocol client with lower RAM usage and better session density.</p></InfoCard>
            <InfoCard title="Chromium"><strong>Browser-based compatibility</strong><p>Persistent WhatsApp Web browser profile through Chromium/Puppeteer with higher CPU/RAM usage.</p></InfoCard>
          </div>
          <Note title="Engine switching">Changing the platform default affects new sessions. Connected sessions keep their active engine; a requested per-session change is deferred rather than forcing logout or immediate QR pairing.</Note>
        </DocSection>

        <DocSection id="troubleshooting" eyebrow="Operations" title="Troubleshooting" intro="Start with the session state, then inspect worker health and only log out when re-pairing is actually required.">
          <div className="troubleshooting-list">
            <Trouble title="QR keeps loading" answer="Check the session state and worker lease. If state is need_scan, read the latest QR again. Avoid repeatedly creating new sessions."/>
            <Trouble title="API accepted but no message sent" answer="Read the message status and failure reason. Check session connectivity, worker ownership, and the private dispatch endpoint. Retry policy belongs in your application."/>
            <Trouble title="Session keeps reconnecting" answer="Inspect diagnostics and network stability. Restart can be tried without logout. Logout should be reserved for intentionally re-pairing the WhatsApp account."/>
            <Trouble title="Webhook keeps failing" answer="Confirm public HTTPS reachability, verify your endpoint returns 2xx quickly, validate HMAC using the raw body and inspect recent delivery attempts."/>
            <Trouble title="403 from API" answer="Check the key type, scopes and session binding. Dashboard-only management operations are not available to ordinary API keys."/>
          </div>
        </DocSection>

        <DocSection id="production" eyebrow="Launch readiness" title="Production checklist" intro="Use this before putting a customer integration into production.">
          <div className="production-checklist">
            {[
              'Store API keys only in server-side secret/environment storage.',
              'Use a unique clientMessageId for business-critical sends.',
              'Verify webhook signatures and keep the raw request body.',
              'Check failed messages and distinguish transport acceptance from recipient delivery.',
              'Monitor session disconnected/logged_out/reconnecting state.',
              'Implement pacing and bounded retry jobs in your application.',
              'Use HTTPS for webhook/media URLs and avoid private-network targets.',
              'Test failure handling before sending production traffic.',
            ].map((item)=><div key={item}><span>✓</span><p>{item}</p></div>)}
          </div>
        </DocSection>

        <section id="language-examples"><h2>Languages &amp; frameworks</h2><p>Use your session API key with POST /api/send-message. The Bearer key identifies the number; no session ID is needed in the URL. These HTTP examples connect directly to RelayWA.</p><CodeShowcase examples={integrationExamples}/></section><section className="docs-v2-cta"><div><span className="public-kicker">Ready to integrate?</span><h2>Connect a number and send your first API message.</h2><p>Start with the trial, create a scoped key and use the examples above.</p></div><a className="primary-button" href="/login">Start 7-day trial</a></section>
      </article>

      <aside className="docs-v2-toc">
        <span>On this page</span>
        {navGroups.flatMap((group)=>group.items).map(([id,title])=><a key={id} href={'#'+id}>{title}</a>)}
      </aside>
    </div>
  </main>;
}

function DocSection({id,eyebrow,title,intro,children}:{id:string;eyebrow:string;title:string;intro:string;children:React.ReactNode}) {
  return <section className="docs-section docs-section-v2" id={id}><div className="docs-section-head"><span className="public-kicker">{eyebrow}</span><h2>{title}</h2><p>{intro}</p></div>{children}</section>;
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
function Code({value}:{value:string}) { return <pre className="docs-code"><code>{value}</code></pre>; }
function Note({title,children}:{title:string;children:React.ReactNode}) {
  return <div className="docs-note neutral"><strong>{title}</strong><p>{children}</p></div>;
}
function Trouble({title,answer}:{title:string;answer:string}) {
  return <div className="trouble-card"><strong>{title}</strong><p>{answer}</p></div>;
}
function EndpointTable({rows}:{rows:string[][]}) {
  return <div className="docs-endpoints"><div className="docs-endpoint-row head"><span>Method</span><span>Endpoint</span><span>Access</span><span>Description</span></div>{rows.map(([method,path,scope,description])=><div className="docs-endpoint-row" key={method+path}><span className={'method method-'+method.toLowerCase()}>{method}</span><code>{path}</code><span>{scope}</span><span>{description}</span></div>)}</div>;
}
