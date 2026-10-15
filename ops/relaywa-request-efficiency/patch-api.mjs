// Narrow, fail-closed edit to the currently deployed relaywa-api Cloudflare Worker.
// An authorized command-claim poll also updates the worker process heartbeat.
// The existing /heartbeat endpoint remains unchanged as a fallback.
export function applyCommandHeartbeatPatch(source) {
  if(typeof source !== 'string') throw new Error('Expected source text');
  const oldHead='f.post("/commands/claim", async (e) => {\n  let t = await e.req.json(), n = A(t), r = nn(t), s = await e.env.DB.prepare';
  if(source.split(oldHead).length !== 2)
    throw new Error('Cloudflare worker command handler does not match audited baseline');
  const heartbeatSql=`INSERT INTO relaywa_worker_heartbeats (worker_id, first_seen_at, last_seen_at)
     VALUES (?, datetime('now'), datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET last_seen_at = datetime('now')`;
  const newHead=`f.post("/commands/claim", async (e) => {
  let t = await e.req.json(), n = A(t), r = nn(t);
  await e.env.DB.prepare(${JSON.stringify(heartbeatSql)}).bind(n).run();
  e.header('X-RelayWA-Heartbeat-Combined','1');
  let s = await e.env.DB.prepare`;
  return source.replace(oldHead,newHead);
}
