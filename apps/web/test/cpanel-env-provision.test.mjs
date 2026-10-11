import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const script=new URL('../../../scripts/provision-cpanel-env.mjs',import.meta.url);
test('cPanel staging config preserves source secrets, uses postgres Unix tunnel and disables live Stripe',()=>{
 const dir=mkdtempSync(join(tmpdir(),'relaywa-cpanel-env-'));
 try {
  const path=join(dir,'source.env'),out=join(dir,'out');
  const seed='DATABASE_URL=postgresql://demo:demo%21@postgres:5432/relaywa\nJWT_SECRET=abcdefghijklmnopqrstuvwxyz123456789\nWEBHOOK_ENCRYPTION_KEY=Zm9v\nRELAYWA_ADMIN_EMAIL=admin@example.test\nRELAYWA_ADMIN_PASSWORD=dummy-password-not-production\nSTRIPE_MODE=live\nSTRIPE_SECRET_KEY=sk_live_FAKE\nWORKER_DISPATCH_URL=http://127.0.0.1:3002\n';
  writeFileSync(path,seed,{mode:0o600});chmodSync(path,0o600);
  const output=execFileSync(process.execPath,[script.pathname,path,out],{encoding:'utf8'});
  assert.match(output,/redacted/);
  assert.equal(readFileSync(path,'utf8'),seed);
  const api=readFileSync(join(out,'api.env'),'utf8');
  assert.match(api,/host=%2Fhome%2Frelaywa%2F\.relaywa-staging%2Fprivate%2Fpg/);
  assert.match(api,/WORKER_DISPATCH_URL=http:\/\/127\.0\.0\.1:13002/);
  assert.match(api,/STRIPE_MODE=test/);
  assert.match(api,/STRIPE_SECRET_KEY=\n/);
  assert.match(api,/JWT_SECRET=abcdefghijklmnopqrstuvwxyz123456789/);
  assert.equal(statSync(join(out,'api.env')).mode & 0o077,0);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
