import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patchWebhookFusionApi } from '../patch-api.mjs';
import { patchRemoteStoreWebhook } from '../patch-remote-store.mjs';
import { claimWebhookSafely } from '../../relaywa-edge-worker/webhook-fusion.js';

test('combined Cloudflare route retains existing handler implementations and explicit authorization context', () => {
  const original='f.post("/webhooks/enqueue",x);\nf.post("/webhooks/claim",y);\nI.route("/internal/worker", f);';
  const patched=patchWebhookFusionApi(original);
  assert.match(patched,/RELAYWA_WEBHOOK_FUSION_V1/);
  assert.match(patched,/A\(payload\)/);
  assert.match(patched,/f\.fetch\(new Request/);
  assert.match(patched,/await internal\("\/webhooks\/enqueue"/);
  assert.match(patched,/await internal\("\/webhooks\/claim"/);
  assert.match(patched,/X-RelayWA-Webhook-Combined/);
  assert.equal(patched.split('f.post("/webhooks/enqueue",x);').length,2);
  assert.equal(patched.split('f.post("/webhooks/claim",y);').length,2);
  assert.throws(()=>patchWebhookFusionApi(patched),/already present/);
  assert.throws(()=>patchWebhookFusionApi('unrecognized api'),/Unexpected Cloudflare bundle/);
});

test('healthy fused route makes only one request for webhook work',async()=>{
  const called=[];
  const delivery={id:'abc',event_type:'session.connected'};
  const result=await claimWebhookSafely({
    claimNextWebhookDeliveryEnqueued:async()=>{called.push('combined');return {supported:true,delivery};},
    enqueueWebhookDeliveries:async()=>{called.push('enqueue');},
    claimNextWebhookDelivery:async()=>{called.push('claim');return null;},
  });
  assert.deepEqual(result,delivery);
  assert.deepEqual(called,['combined']);
});

test('old API keeps original enqueue-then-claim order, including delivery immediately',async()=>{
  const called=[];
  const result=await claimWebhookSafely({
    claimNextWebhookDeliveryEnqueued:async()=>{called.push('combined');return {supported:false,delivery:null};},
    enqueueWebhookDeliveries:async()=>{called.push('enqueue');return 1;},
    claimNextWebhookDelivery:async()=>{called.push('claim');return {id:'one'};},
  });
  assert.deepEqual(called,['combined','enqueue','claim']);
  assert.equal(result.id,'one');
});

test('legacy stores without the combined method keep original behavior',async()=>{
  const calls=[];
  const result=await claimWebhookSafely({
    enqueueWebhookDeliveries:async()=>{calls.push('enqueue');},
    claimNextWebhookDelivery:async()=>{calls.push('claim');return null;},
  });
  assert.equal(result,null);
  assert.deepEqual(calls,['enqueue','claim']);
});

test('ambiguous combined claim failures cannot trigger a duplicate claim',async()=>{
  const calls=[];
  await assert.rejects(claimWebhookSafely({
    claimNextWebhookDeliveryEnqueued:async()=>{calls.push('combined');throw Error('timeout after claim');},
    enqueueWebhookDeliveries:async()=>{calls.push('enqueue');},
    claimNextWebhookDelivery:async()=>{calls.push('claim');},
  }),/timeout after claim/);
  assert.deepEqual(calls,['combined']);
});

test('worker store fallback triggers only on definitive missing-route errors',()=>{
  const original=`class RemoteStore {
  async claimNextWebhookDelivery() { return null; }
}`;
  const patched=patchRemoteStoreWebhook(original);
  assert.match(patched,/retries:1/);
  assert.match(patched,/\[404,405,501\]/);
  assert.match(patched,/parseJsonFields\(result\.delivery/);
  assert.throws(()=>patchRemoteStoreWebhook(patched),/already installed/);
});

test('worker still uses 15-second cycle, session status and outbound pickup unchanged',async()=>{
  const command=await readFile(new URL('../../relaywa-edge-worker/command-loop.js',import.meta.url),'utf8');
  const outbound=await readFile(new URL('../../relaywa-edge-worker/outbound-poll.js',import.meta.url),'utf8');
  assert.match(command,/await claimWebhookSafely\(store\)/);
  assert.match(command,/await sleep\(ACTIVE_POLL_MS, signal\)/);
  assert.match(command,/await store\.claimNextCommand\(\)/);
  assert.match(outbound,/await store\.pollDirectMessage\(\)/);
  assert.match(outbound,/sessions\.sendText\(/);
});
