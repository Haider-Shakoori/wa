'use client';

import { FormEvent, useMemo, useState } from 'react';
import { API_BASE, api } from '../lib/api';

const scopeOptions = [
  ['sessions.read','Read sessions'],
  ['messages.read','Read messages'],
  ['messages.send','Send messages'],
  ['contacts.read','Read contacts'],
  ['chats.read','Read chats'],
  ['groups.read','Read groups'],
  ['webhooks.read','Read webhooks'],
];

const languages = ['Laravel / PHP','Node.js','Python','C# / .NET','Java','Go','cURL'];

export function DeveloperGuide({
  token,
  sessions,
  keys,
  onRefresh,
}:{
  token:string;
  sessions:any[];
  keys:any[];
  onRefresh:()=>Promise<void>;
}) {
  const [keyName,setKeyName] = useState('My application');
  const [tokenType,setTokenType] = useState<'organization'|'session'>('organization');
  const [sessionId,setSessionId] = useState(sessions[0]?.id ?? '');
  const [scopes,setScopes] = useState<string[]>(['sessions.read','messages.read','messages.send']);
  const [createdToken,setCreatedToken] = useState('');
  const [language,setLanguage] = useState('Laravel / PHP');
  const [error,setError] = useState('');
  const [copied,setCopied] = useState('');

  const selectedSession = sessions.find((item)=>item.id===sessionId) ?? sessions[0];
  const effectiveSessionId = selectedSession?.id ?? 'YOUR_SESSION_ID';
  const apiToken = createdToken || 'YOUR_RELAYWA_API_KEY';

  const snippet = useMemo(
    ()=>buildSnippet(language,API_BASE,effectiveSessionId,apiToken),
    [language,effectiveSessionId,apiToken],
  );

  async function createKey(event:FormEvent) {
    event.preventDefault();
    setError('');
    setCreatedToken('');
    try {
      const payload:any = {
        name:keyName.trim(),
        tokenType,
        scopes,
      };
      if (tokenType === 'session') {
        if (!sessionId) throw new Error('Choose a WhatsApp session for a session token.');
        payload.sessionId = sessionId;
      }

      const result = await api<any>('/v1/api-keys',token,{
        method:'POST',
        body:JSON.stringify(payload),
      });
      setCreatedToken(result.token);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create API key');
    }
  }

  function toggleScope(scope:string) {
    setScopes((current)=>current.includes(scope)?current.filter((item)=>item!==scope):[...current,scope]);
  }

  async function copy(value:string,label:string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(()=>setCopied(''),1400);
  }

  return <div className="integration-grid">
    <section className="integration-card">
      <p className="eyebrow">Step 1</p>
      <h3>Create an API key</h3>
      <p className="muted">Use an organization key for apps that work with multiple sessions, or bind a token to one WhatsApp session.</p>

      <form className="api-key-form" onSubmit={createKey}>
        <label>Key name<input value={keyName} onChange={(e)=>setKeyName(e.target.value)} required minLength={2}/></label>

        <label>Credential type
          <select value={tokenType} onChange={(e)=>setTokenType(e.target.value as 'organization'|'session')}>
            <option value="organization">Organization API key</option>
            <option value="session">Session-bound token</option>
          </select>
        </label>

        {tokenType === 'session' && <label>WhatsApp session
          <select value={sessionId} onChange={(e)=>setSessionId(e.target.value)} required>
            <option value="">Choose a session</option>
            {sessions.map((session)=><option key={session.id} value={session.id}>{session.name} {session.phone_number ? '(+' + session.phone_number + ')' : ''}</option>)}
          </select>
        </label>}

        <div>
          <p className="eyebrow">Scopes</p>
          <div className="scope-grid">
            {scopeOptions.map(([scope,label])=><label className="scope-option" key={scope}>
              <input type="checkbox" checked={scopes.includes(scope)} onChange={()=>toggleScope(scope)}/>
              <span>{label}</span>
            </label>)}
          </div>
        </div>

        {error && <div className="alert">{error}</div>}
        <button className="primary-button" type="submit">Create API key</button>
      </form>

      {createdToken && <div className="token-reveal">
        <strong>Copy this token now</strong>
        <p className="muted">relayWA stores only its hash. The full token cannot be shown again later.</p>
        <code>{createdToken}</code>
        <button className="secondary-button" type="button" onClick={()=>void copy(createdToken,'token')}>{copied==='token'?'Copied':'Copy token'}</button>
      </div>}

      {!!keys.length && <div style={{marginTop:18}}>
        <p className="eyebrow">Existing credentials</p>
        {keys.slice(0,6).map((key)=><div className="session-row" key={key.id}><div className="grow"><strong>{key.name}</strong><span>{key.key_prefix}… · {key.token_type}</span></div><span className={key.revoked_at?'state state-error':'state state-connected'}><span className="state-dot"/>{key.revoked_at?'revoked':'active'}</span></div>)}
      </div>}
    </section>

    <section className="integration-card">
      <p className="eyebrow">Step 2</p>
      <h3>Connect your application</h3>
      <p className="muted">Choose the WhatsApp session your software will send through. The examples below call the same relayWA REST endpoint.</p>

      <label className="guide-session-select">WhatsApp session
        <select value={sessionId} onChange={(e)=>setSessionId(e.target.value)}>
          <option value="">Choose a session</option>
          {sessions.map((session)=><option key={session.id} value={session.id}>{session.name} {session.phone_number ? '— +' + session.phone_number : ''}</option>)}
        </select>
      </label>

      {selectedSession && <div className="connected-banner">
        <strong>{selectedSession.name}</strong>
        <div>{selectedSession.phone_number ? 'Connected number: +' + selectedSession.phone_number : 'This session is not linked to a number yet.'}</div>
        <small>Session ID: {selectedSession.id}</small>
      </div>}

      <div className="guide-steps">
        <div><b>1</b><span>Create a key with <code>messages.send</code>.</span></div>
        <div><b>2</b><span>Store it in your server environment, never in browser/mobile source code.</span></div>
        <div><b>3</b><span>Send <code>Authorization: Bearer YOUR_KEY</code>.</span></div>
        <div><b>4</b><span>POST to the session message endpoint with <code>to</code> and <code>text</code>.</span></div>
        <div><b>5</b><span>Use a unique <code>clientMessageId</code> to prevent duplicate sends.</span></div>
      </div>

      <div className="code-tabs">{languages.map((item)=><button key={item} className={language===item?'code-tab active':'code-tab'} onClick={()=>setLanguage(item)}>{item}</button>)}</div>

      <div className="code-block">
        <button className="copy-button" onClick={()=>void copy(snippet,'snippet')}>{copied==='snippet'?'Copied':'Copy'}</button>
        <pre>{snippet}</pre>
      </div>

      <div className="guide-notes">
        <h4>Endpoint</h4>
        <code>{API_BASE + '/v1/sessions/' + effectiveSessionId + '/messages/text'}</code>
        <h4>Phone format</h4>
        <p>Use international format without a leading local zero. Example: <code>93744119422</code>.</p>
        <h4>Security</h4>
        <p>Keep API keys on your backend. For browser or mobile apps, call your own backend and let your backend call relayWA.</p>
      </div>
    </section>
  </div>;
}

function buildSnippet(language:string,base:string,sessionId:string,token:string) {
  const endpoint = base + '/v1/sessions/' + sessionId + '/messages/text';
  const payload = '{"to":"93744119422","text":"Hello from my app","clientMessageId":"order-1001"}';

  if (language === 'Laravel / PHP') {
    return [
      "use Illuminate\\Support\\Facades\\Http;",
      "",
      "$response = Http::withToken(env('RELAYWA_API_KEY'))",
      "    ->post('" + endpoint + "', [",
      "        'to' => '93744119422',",
      "        'text' => 'Hello from Laravel',",
      "        'clientMessageId' => 'order-1001',",
      "    ]);",
      "",
      "$message = $response->throw()->json();",
      "",
      "// .env",
      "RELAYWA_API_KEY=" + token,
    ].join('\n');
  }

  if (language === 'Node.js') {
    return [
      "const response = await fetch('" + endpoint + "', {",
      "  method: 'POST',",
      "  headers: {",
      "    'Authorization': 'Bearer ' + process.env.RELAYWA_API_KEY,",
      "    'Content-Type': 'application/json'",
      "  },",
      "  body: JSON.stringify({",
      "    to: '93744119422',",
      "    text: 'Hello from Node.js',",
      "    clientMessageId: 'order-1001'",
      "  })",
      "});",
      "",
      "const message = await response.json();",
    ].join('\n');
  }

  if (language === 'Python') {
    return [
      "import os",
      "import requests",
      "",
      "response = requests.post(",
      "    '" + endpoint + "',",
      "    headers={'Authorization': 'Bearer ' + os.environ['RELAYWA_API_KEY']},",
      "    json={",
      "        'to': '93744119422',",
      "        'text': 'Hello from Python',",
      "        'clientMessageId': 'order-1001',",
      "    },",
      ")",
      "response.raise_for_status()",
      "print(response.json())",
    ].join('\n');
  }

  if (language === 'C# / .NET') {
    return [
      "using System.Net.Http.Headers;",
      "",
      "var client = new HttpClient();",
      "client.DefaultRequestHeaders.Authorization =",
      "    new AuthenticationHeaderValue(\"Bearer\", Environment.GetEnvironmentVariable(\"RELAYWA_API_KEY\"));",
      "",
      "var response = await client.PostAsJsonAsync(",
      "    \"" + endpoint + "\",",
      "    new { to = \"93744119422\", text = \"Hello from .NET\", clientMessageId = \"order-1001\" });",
      "",
      "response.EnsureSuccessStatusCode();",
    ].join('\n');
  }

  if (language === 'Java') {
    return [
      "var client = java.net.http.HttpClient.newHttpClient();",
      "var request = java.net.http.HttpRequest.newBuilder()",
      "    .uri(java.net.URI.create(\"" + endpoint + "\"))",
      "    .header(\"Authorization\", \"Bearer \" + System.getenv(\"RELAYWA_API_KEY\"))",
      "    .header(\"Content-Type\", \"application/json\")",
      "    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(",
      "        \"" + payload.replace(/"/g,'\\\"') + "\"))",
      "    .build();",
      "",
      "var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());",
    ].join('\n');
  }

  if (language === 'Go') {
    return [
      "payload := strings.NewReader(\"" + payload.replace(/"/g,'\\\"') + "\")",
      "req, _ := http.NewRequest(\"POST\", \"" + endpoint + "\", payload)",
      "req.Header.Set(\"Authorization\", \"Bearer \"+os.Getenv(\"RELAYWA_API_KEY\"))",
      "req.Header.Set(\"Content-Type\", \"application/json\")",
      "",
      "res, err := http.DefaultClient.Do(req)",
      "if err != nil { log.Fatal(err) }",
      "defer res.Body.Close()",
    ].join('\n');
  }

  return [
    "curl -X POST '" + endpoint + "' \\",
    "  -H 'Authorization: Bearer " + token + "' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '" + payload + "'",
  ].join('\n');
}
