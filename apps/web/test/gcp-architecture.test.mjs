import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const read = path => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');

test('Caddy serves the website and API without exposing database or worker ports', () => {
  const config = read('deploy/gcp/Caddyfile');
  assert.match(config, /protocols h1 h2 h3/);
  assert.match(config, /encode zstd gzip/);
  assert.match(config, /@api path \/api \/api\/\*/);
  assert.match(config, /reverse_proxy 127\.0\.0\.1:3001/);
  assert.match(config, /reverse_proxy 127\.0\.0\.1:3000/);
  assert.doesNotMatch(config, /:5432|:6379|:3002/);
});
test('staging is authenticated and nonindexable', () => {
  const conf = read('deploy/gcp/Caddyfile.staging');
  assert.match(conf, /basic_auth/);
  assert.match(conf, /noindex,nofollow,noarchive/);
});
test('GCE production services use Node.js and do not start the worker', () => {
  const web = read('deploy/gcp/relaywa-web.service');
  const api = read('deploy/gcp/relaywa-api.service');
  assert.match(web, /--env-file=\/etc\/relaywa\/web\.env/);
  assert.match(api, /--env-file=\/etc\/relaywa\/api\.env/);
  assert.match(api, /dist\/main\.js/);
  assert.match(web, /apps\/web\/server\.js/);
  assert.doesNotMatch(web + api, /deploy-worker|baileys|docker compose|migrate/);
});
test('VPS reverse tunnel keeps PostgreSQL Redis and worker private', () => {
  const script = read('deploy/gcp/vps-to-gce-tunnel.sh');
  assert.match(script, /-R "\$SOCKET:\$PG_IP:5432"/);
  assert.match(script, /-R "127\.0\.0\.1:16379:\$REDIS_IP:6379"/);
  assert.match(script, /-R "127\.0\.0\.1:13002:\$WORKER_IP:3002"/);
  assert.doesNotMatch(script, /docker compose (down|stop)|docker stop|iptables -F/);
});

test('GCE private environment generator leaves the VPS original intact', () => {
  const dir=mkdtempSync(join(tmpdir(),'relaywa-gce-'));
  const input=join(dir,'source.env'),target=join(dir,'out');
  try {
    const original=[
      'DATABASE_URL=postgresql://relaywa:secret@postgres:5432/relaywa',
      'REDIS_URL=redis://:pass@redis:6379/0',
      'JWT_SECRET=this-is-a-valid-length-private-test-secret',
      'WEBHOOK_ENCRYPTION_KEY=placeholder-not-real',
      'WORKER_DISPATCH_SECRET=placeholder-not-real',
      'STRIPE_MODE=live',
      'STRIPE_SECRET_KEY=sk_live_FAKE_EXAMPLE',
    ].join('\n')+'\n';
    writeFileSync(input,original,{mode:0o600});
    chmodSync(input,0o600);
    execFileSync(process.execPath,[new URL('../../../scripts/provision-gcp-env.mjs',import.meta.url).pathname,input,target],{encoding:'utf8'});
    assert.equal(readFileSync(input,'utf8'),original);
    const api=readFileSync(join(target,'api.env'),'utf8');
    assert.match(api,/host=%2Fsrv%2Frelaywa%2Fprivate%2Fpg/);
    assert.match(api,/redis:\/\/:pass@127\.0\.0\.1:16379\/0/);
    assert.match(api,/WORKER_DISPATCH_URL=http:\/\/127\.0\.0\.1:13002/);
    assert.match(api,/STRIPE_MODE=live/);
    assert.equal(statSync(join(target,'api.env')).mode & 0o077,0);
    execFileSync(process.execPath,[new URL('../../../scripts/provision-gcp-env.mjs',import.meta.url).pathname,input,target,'--staging'],{encoding:'utf8'});
    const stage=readFileSync(join(target,'stage-api.env'),'utf8');
    assert.match(stage,/STRIPE_MODE=test/);
    assert.match(stage,/STRIPE_SECRET_KEY=\n/);
    assert.equal(readFileSync(input,'utf8'),original);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
