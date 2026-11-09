// Read-only migration smoke test. Never sends messages or authenticates users.
const current = process.env.RELAYWA_CURRENT_ORIGIN ?? 'https://relaywa.com';
const candidate = process.env.RELAYWA_VPS_ORIGIN ?? 'https://relaywa-vps-origin.relaywa.com';
const routes = [
  ['/api/health', 200],
  ['/api/auth/providers', 200],
  ['/api/auth/me', 401],
  ['/api/v1/sessions', 401],
  ['/api/v1/sessions/test-only/messages/text', 401],
];
async function status(origin, path, method = 'GET', body) {
  const response = await fetch(new URL(path, origin), {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
    redirect: 'manual',
  });
  return response.status;
}
let failed = false;
for (const [path, expected] of routes) {
  try {
    const [live, vps] = await Promise.all([status(current, path), status(candidate, path)]);
    console.log(`${path}: live=${live}, vps=${vps}, expected=${expected}`);
    if (live !== expected || vps !== expected) failed = true;
  } catch (error) { console.error(path, error.message); failed = true; }
}
for (const path of ['/api/b2b', '/api/v1/b2b']) {
  try {
    const [live, vps] = await Promise.all([status(current, path), status(candidate, path)]);
    console.log(`B2B exception ${path}: live=${live}, vps=${vps}`);
    if (live !== vps) console.log('BLOCKER: blanket /api rewrite would change B2B behavior');
  } catch (error) { console.error(path, error.message); failed = true; }
}
try {
  const [live, vps] = await Promise.all([
    status(current, '/api/auth/login', 'POST', {}),
    status(candidate, '/api/auth/login', 'POST', {}),
  ]);
  console.log(`POST /api/auth/login invalid payload: live=${live}, vps=${vps}`);
  if (live !== 400 || vps !== 400) failed = true;
} catch (error) { console.error(error.message); failed = true; }
if (failed) process.exitCode = 1;
