const base = process.env.SMOKE_BASE_URL;
if (!base) throw new Error('SMOKE_BASE_URL is required');

const response = await fetch(`${base.replace(/\/$/, '')}/api/health`);
if (!response.ok) throw new Error(`Health check failed: HTTP ${response.status}`);
const body = await response.json();
if (body.status !== 'ok' || body.brand !== 'relayWA') {
  throw new Error('Unexpected health response');
}
console.log(JSON.stringify({ ok: true, health: body }, null, 2));
