import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  SESSION_STATES,interpretSession,createSessionDiagnostics
} from '../../../examples/relaywa-session-diagnostics/diagnose.mjs';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const originalStatuses=readFileSync(new URL('../../../apps/api/src/sessions/session-status.ts',import.meta.url),'utf8');
const controller=readFileSync(new URL('../../../apps/api/src/sessions/sessions.controller.ts',import.meta.url),'utf8');
const service=readFileSync(new URL('../../../apps/api/src/sessions/sessions.service.ts',import.meta.url),'utf8');
const qrService=readFileSync(new URL('../../../apps/api/src/sessions/qr.service.ts',import.meta.url),'utf8');

test('all nine diagnostic states are real backend statuses, no invented states or automatic logout',()=>{
  assert.deepEqual(SESSION_STATES,[
    'pending','need_scan','connecting','connected','disconnected',
    'reconnecting','logged_out','expired','error',
  ]);
  for(const status of SESSION_STATES)assert.ok(originalStatuses.includes("'"+status+"'"),status);
  for(const status of SESSION_STATES){
    const result=interpretSession({status},{status,available:false});
    assert.equal(result.status,status);
    assert.ok(result.finding.length>=15);
    assert.ok(result.next.length>35);
    assert.equal(result.qrAvailable,false);
    assert.doesNotMatch(result.next,/automatically.*logout/i);
  }
  assert.match(interpretSession({status:'reconnecting'},{available:false}).next,/avoid.*logout/);
  assert.match(interpretSession({status:'logged_out'},{available:false}).next,/re-pair/);
  assert.equal(interpretSession({status:'unknown'},{available:false}).status,'unrecognized');
});

test('QR availability follows actual session state and protects expiry/identity race',()=>{
  assert.equal(interpretSession({status:'need_scan'},{status:'need_scan',available:true}).qrAvailable,true);
  assert.equal(interpretSession({status:'need_scan'},{status:'connecting',available:true}).qrAvailable,false);
  assert.equal(interpretSession({status:'need_scan'},{status:'need_scan',available:false}).qrAvailable,false);
  assert.match(qrService,/qr_expires_at/);
  assert.match(qrService,/available:\s*false/);
  assert.match(qrService,/available:\s*true/);
  assert.match(controller,/@Get\(\[':sessionId\/qrcode',':sessionId\/qr'\]\)/);
});

test('read-only diagnostics send only GET and never return QR payload, tokens or raw worker errors',async()=>{
  const id='123e4567-e89b-12d3-a456-426614174000';
  const key='test-private-key-DO-NOT-LOG';
  const qr='SECRET-QR-PAYLOAD',dataUrl='data:image/png;base64,SECRETQR';
  const calls=[];
  const fetchImpl=async (url,opts)=>{
    calls.push({url,opts});
    return {ok:true,status:200,json:async()=>url.endsWith('/qrcode')
      ? {sessionId:id,status:'need_scan',available:true,qr,dataUrl,expiresAt:'2026-10-11T00:00:00.000Z'}
      : {id,status:'need_scan',last_connection_error:'SECRET_WORKER_VALUE'}};
  };
  const run=createSessionDiagnostics({key,fetchImpl});
  const result=await run(id);
  assert.deepEqual(result,{
    status:'need_scan',qrAvailable:true,
    finding:'QR is available for the authorized account owner to scan.',
    next:'Show the QR securely to the account owner in RelayWA, then check session status.',
  });
  assert.equal(calls.length,2);
  assert.ok(calls.every(c=>c.opts.method==='GET'));
  assert.ok(calls.every(c=>c.opts.headers.Authorization==='Bearer '+key));
  assert.ok(calls.every(c=>c.url.startsWith('https://relaywa.com/api/whatsapp-sessions/'+id)));
  assert.equal(JSON.stringify(result).includes('SECRET'),false);
  assert.equal(JSON.stringify(result).includes(key),false);
  assert.equal(JSON.stringify(result).includes('dataUrl'),false);
  await assert.rejects(()=>run('not-a-uuid'),/session UUID/);
  assert.throws(()=>createSessionDiagnostics({key,apiBase:'http://localhost:3000/api'}),/HTTPS/);
});

test('403 and disconnected sessions are reported without retries or lifecycle side effects',async()=>{
  const id='123e4567-e89b-12d3-a456-426614174000';
  const blocked=createSessionDiagnostics({key:'test-key',fetchImpl:async()=>({
    ok:false,status:403,json:async()=>({token:'SECRET'})
  })});
  await assert.rejects(()=>blocked(id),/HTTP 403/);
  const source=readFileSync(new URL('../../../examples/relaywa-session-diagnostics/diagnose.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/method:'POST'/);
  assert.doesNotMatch(source,/console\.log\(.*qr/i);
  assert.match(service,/commandId, sessionId, action, status: 'queued'/);
  assert.match(controller,/@Post\(':sessionId\/restart'\)/);
  assert.match(controller,/@Post\(\[':sessionId\/disconnect',':sessionId\/logout'\]\)/);
});

test('published QR guide documents read-only diagnostics, nine actual states and policy caveats',()=>{
  const article=read('lib/blog-articles.ts');
  const registry=read('lib/public-pages.ts');
  const script=readFileSync(new URL('../../../examples/relaywa-session-diagnostics/diagnose.mjs',import.meta.url),'utf8');
  assert.match(article,/slug: 'whatsapp-api-qr-session-troubleshooting'/);
  for(const v of SESSION_STATES)assert.ok(article.includes(v),'Missing '+v+' in article corpus');
  assert.match(article,/status queued/);
  assert.match(article,/available: false/);
  assert.match(article,/Bearer SERVER_SIDE_KEY_WITH_SESSIONS_READ/);
  assert.match(article,/does not automatically schedule or retry messages/);
  assert.match(registry,/\/blog\/whatsapp-api-qr-session-troubleshooting/);
  assert.match(script,/NEVER print qr, dataUrl/);
  assert.match(script,/sessions.read/);
});