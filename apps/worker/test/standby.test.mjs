import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const entry = fileURLToPath(new URL('../standby.mjs', import.meta.url));
test('standby only sends a heartbeat with worker identity and stops on SIGTERM', async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    requests.push({ path: req.url, method: req.method, auth: req.headers.authorization, body: JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, WORKER_ID: 'relaywa-worker-02',
      RELAYWA_API_URL: 'http://127.0.0.1:' + port, WORKER_DISPATCH_SECRET: 'standby-test-token' },
    stdio: 'ignore',
  });
  try {
    const deadline = Date.now() + 5000;
    while (!requests.length && Date.now() < deadline && child.exitCode === null) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], {
      path: '/internal/worker/heartbeat', method: 'POST',
      auth: 'Bearer standby-test-token', body: { workerId: 'relaywa-worker-02' },
    });
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
    await new Promise(resolve => server.close(resolve));
  }
});
test('standby rejects missing credentials without starting', async () => {
  const child = spawn(process.execPath, [entry], {
    env: { PATH: process.env.PATH, WORKER_ID: 'relaywa-worker-02',
      RELAYWA_API_URL: 'http://127.0.0.1:9999' }, stdio: 'ignore',
  });
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.equal(code, 1);
});
