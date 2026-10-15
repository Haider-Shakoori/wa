import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyCommandHeartbeatPatch } from '../patch-api.mjs';
import { patchRemoteStore } from '../patch-remote-store.mjs';

test('API injection only changes the existing authenticated command claim handler', () => {
  const sample='f.post("/commands/claim", async (e) => {\n  let t = await e.req.json(), n = A(t), r = nn(t), s = await e.env.DB.prepare("select 1")';
  const result=applyCommandHeartbeatPatch(sample);
  assert.match(result,/relaywa_worker_heartbeats/);
  assert.match(result,/X-RelayWA-Heartbeat-Combined/);
  assert.match(result,/let s = await e.env.DB.prepare/);
  assert.equal(result.split('/commands/claim').length,2);
  assert.throws(()=>applyCommandHeartbeatPatch(result),/audited baseline/);
  assert.throws(()=>applyCommandHeartbeatPatch('unexpected version'),/audited baseline/);
});

test('remote store confirms heartbeat only when the signed API response says so', () => {
  const source=`class RemoteStore {
  constructor() {
    this.cooldownUntil = 0;
  }
  async close() { /* no persistent connections */ }
  async call() {
        return payload;
  }
}`;
  const patched=patchRemoteStore(source);
  assert.match(patched,/this.commandHeartbeatConfirmedAt = 0/);
  assert.match(patched,/response.headers.get\('x-relaywa-heartbeat-combined'\)/);
  assert.match(patched,/commandClaimHeartbeatVerified\(\)/);
  assert.throws(()=>patchRemoteStore(patched),/Unexpected RemoteStore layout/);
});

test('worker preserves 15-second checks and sends normal heartbeat on unpatched API', async () => {
  const content=await readFile(new URL('../../relaywa-edge-worker/command-loop.js',import.meta.url),'utf8');
  assert.match(content,/store\.commandClaimHeartbeatVerified\?\.\(\) === true/);
  assert.match(content,/const combined = activeSessions && commandClaimSucceeded/);
  assert.match(content,/if \(!combined\) \{/);
  assert.match(content,/await store\.heartbeatWorker\(\)/);
  assert.match(content,/await store\.claimNextCommand\(\)/);
  assert.match(content,/Date\.now\(\) \+ 15_000/);
  assert.match(content,/await claimWebhookSafely\(store\)/);
  const webhookHelper=await readFile(new URL('../../relaywa-edge-worker/webhook-fusion.js',import.meta.url),'utf8');
  assert.match(webhookHelper,/return store\.claimNextWebhookDelivery\(\)/);
});
