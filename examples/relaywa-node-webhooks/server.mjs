/**
 * Standalone Node 20+ example for a backend integration (never browser code).
 * No official Meta Cloud API claims. Use only for recipients who opted in.
 *
 * Run: RELAYWA_SESSION_KEY=... RELAYWA_WEBHOOK_SECRET=... node server.mjs
 * Endpoint POST /incoming-relaywa-webhook; health GET /health
 */
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const PUBLIC_API_BASE = 'https://relaywa.com/api';

export function verifyRelayWaWebhook(rawBody, headers, secret, {nowSeconds=Math.floor(Date.now()/1000), maxAgeSeconds=300}={}) {
  if (!Buffer.isBuffer(rawBody) || !secret) return false;
  const timestamp = String(headers['x-relaywa-timestamp'] ?? '');
  const signature = String(headers['x-relaywa-signature'] ?? '');
  if (!/^\d{10}$/.test(timestamp) || Math.abs(nowSeconds-Number(timestamp)) > maxAgeSeconds) return false;
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  // Contract: HMAC-SHA256(secret, timestamp + '.' + exact raw HTTP request bytes).
  const computed = createHmac('sha256', secret).update(timestamp).update('.').update(rawBody).digest();
  const submitted = Buffer.from(signature.slice(7), 'hex');
  return submitted.length===computed.length && timingSafeEqual(submitted,computed);
}

export function createRelayWaClient({sessionKey, apiBase=PUBLIC_API_BASE, fetchImpl=fetch}){
  if (typeof sessionKey !== 'string' || !sessionKey.trim()) throw new Error('Session key is required');
  if (!/^https:\/\//.test(apiBase)) throw new Error('Use an HTTPS RelayWA API base');
  return async function sendText({to,text,clientMessageId}) {
    if(!/^\d{7,32}$/.test(to)) throw new Error('Pass an international recipient number containing digits only');
    if(!text || !clientMessageId || clientMessageId.length > 120) throw new Error('A message and stable clientMessageId are required');
    let response;
    try {
      response=await fetchImpl(apiBase.replace(/\/$/,'')+'/send-message',{
        method:'POST',
        headers:{Authorization:'Bearer '+sessionKey,'Content-Type':'application/json'},
        body:JSON.stringify({to,text,clientMessageId}),
        signal:AbortSignal.timeout(30_000),
      });
    } catch(error) {
      // The worker may have accepted the send. Do NOT generate a new ID and
      // retry blindly: query status or repeat only with the same idempotency key.
      const uncertain=new Error('Send outcome uncertain: inspect RelayWA message/session status before retrying with the SAME clientMessageId');
      uncertain.cause=error;
      throw uncertain;
    }
    const payload=await response.json().catch(()=>null);
    if(!response.ok || !payload?.success){
      const err=new Error('RelayWA send rejected (HTTP '+response.status+'); inspect details and session state');
      err.status=response.status;
      err.messageId=payload?.messageId ?? payload?.data?.id ?? null;
      throw err;
    }
    return payload.data;
  };
}

export function createWebhookListener({secret, onEvent, maxBytes=1_000_000, nowSeconds}){
  if(!secret || typeof onEvent!=='function')throw new Error('Webhook secret and event handler required');
  return async function handle(request,response){
    if(request.method==='GET' && request.url==='/health'){response.writeHead(200);response.end('ok');return;}
    if(request.url!=='/incoming-relaywa-webhook' || request.method!=='POST'){response.writeHead(404);response.end();return;}
    const chunks=[];let size=0;
    for await (const chunk of request){
      size+=chunk.length;
      if(size>maxBytes){response.writeHead(413);response.end('Payload too large');return;}
      chunks.push(chunk);
    }
    const raw=Buffer.concat(chunks);
    if(!verifyRelayWaWebhook(raw,request.headers,secret,{nowSeconds:nowSeconds?.() ?? Math.floor(Date.now()/1000)})){
      response.writeHead(401);response.end('Invalid webhook signature or timestamp');return;
    }
    let event;
    try {event=JSON.parse(raw.toString('utf8'));}
    catch{response.writeHead(400);response.end('Malformed JSON');return;}
    // In production, store event.id with a UNIQUE constraint and handle duplicates
    // durably. This example only demonstrates authenticated webhook ingestion.
    await onEvent(event);
    response.writeHead(204);response.end();
  };
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const secret=process.env.RELAYWA_WEBHOOK_SECRET;
  if(!secret)throw new Error('Set RELAYWA_WEBHOOK_SECRET (from RelayWA webhook creation)');
  const onEvent=async(event)=>{
    // Replace this logging with durable idempotent queue processing.
    console.log('Verified RelayWA event',event.id,event.type);
  };
  createServer(createWebhookListener({secret,onEvent})).listen(Number(process.env.PORT||3001));
}
