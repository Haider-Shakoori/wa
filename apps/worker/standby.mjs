/**
 * Standard worker standby mode. Does not import the WhatsApp runtime, claim
 * commands, recover sessions, dispatch messages, or touch auth directories.
 * The platform's existing worker list reads relaywa_worker_heartbeats.
 *
 * Required: WORKER_ID, RELAYWA_API_URL, WORKER_DISPATCH_SECRET.
 * This is deliberately NOT an enterprise worker.
 */
const workerId = process.env.WORKER_ID;
const apiUrl = process.env.RELAYWA_API_URL;
const secret = process.env.WORKER_DISPATCH_SECRET;
if (!workerId || !/^relaywa-worker-[a-z0-9-]+$/.test(workerId) || !apiUrl || !secret) {
  console.error('Missing or invalid standby worker configuration');
  process.exit(1);
}
const endpoint = new URL('/internal/worker/heartbeat', apiUrl);
if (!['https:', 'http:'].includes(endpoint.protocol)) throw Error('Invalid API protocol');
const abort = new AbortController();
process.once('SIGTERM', () => abort.abort());
process.once('SIGINT', () => abort.abort());
async function heartbeat() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret, 'content-type': 'application/json' },
    body: JSON.stringify({ workerId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('Heartbeat HTTP ' + response.status);
  console.log(JSON.stringify({ workerId, mode: 'standby', heartbeat: 'ok', at: new Date().toISOString() }));
}
while (!abort.signal.aborted) {
  try { await heartbeat(); } catch (error) {
    console.error(JSON.stringify({ workerId, mode: 'standby', heartbeat: 'failed', error: error.message }));
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 15000);
    abort.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
