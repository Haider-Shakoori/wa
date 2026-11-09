import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('legacy worker refuses enterprise identity before opening DB or sessions',()=>{
 const code="import('./src/index.js').then(m=>m.startWorker()).then(()=>process.exit(12)).catch(e=>{if(!String(e.message).includes('Enterprise worker startup blocked'))process.exit(13)})";
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{
  cwd:new URL('..',import.meta.url).pathname,
  env:{...process.env,WORKER_ID:'enterprise-11111111-1111-1111-1111-111111111111',DATABASE_URL:'postgresql://invalid:invalid@127.0.0.1:1/invalid'},
  encoding:'utf8',timeout:12000
 });
 assert.equal(r.status,0,r.stderr);
});
