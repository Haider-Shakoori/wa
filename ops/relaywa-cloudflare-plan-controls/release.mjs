// One-time guarded rollout for RelayWA plan editing and availability.
// The script mutates only D1 subscription_plans schema and the three named Worker deployments.
// Source binaries were already uploaded as inactive versions; no credentials are printed.
const APP='relaywa';
const changes=[
  {name:'relaywa-api',before:'d024b12d-a3ff-4c2d-9410-3e842094e01b',after:'122829c2-db1d-49e1-8038-f3bc355b2031'},
  {name:'relaywa-platform',before:'1d610cf7-56d1-450a-92ff-12777467291a',after:'3eb22452-a378-4e77-a201-53f3b62e939d'},
  {name:'relaywa-web',before:'7ed59153-0fd7-4ee0-82ab-e1460729724d',after:'96b215ef-8208-4e3f-804d-bc74918d1053'},
];
if(process.env.GITHUB_REF!=='refs/heads/fix/relaywa-cloudflare-plan-controls-20261014' ||
   process.env.RELAYWA_RELEASE_CONFIRM!=='APPLY_RELAYWA_PLAN_CONTROLS_20261014')
  throw Error('Release confirmation/branch mismatch');
const id=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Missing Cloudflare permissions');
const root='https://api.cloudflare.com/client/v4/accounts/'+id;
const headers={authorization:'Bearer '+token,'content-type':'application/json'};
async function cf(url,options={}) {
  const response=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok||!result.success)
    throw Error('Cloudflare HTTP '+response.status+' '+JSON.stringify(result.errors?.map(e=>({code:e.code,message:String(e.message).slice(0,140)}))));
  return result.result;
}
const instances=(await cf(root+'/d1/database?per_page=100')).filter(d=>d.name===APP);
if(instances.length!==1)throw Error('Cannot safely identify RelayWA D1 database');
const d1=root+'/d1/database/'+instances[0].uuid;
async function sql(statement) {
  const r=await cf(d1+'/query',{method:'POST',body:JSON.stringify({sql:statement})});
  if(!Array.isArray(r)||r.some(x=>x.success===false))throw Error('D1 SQL failed');
  return r[0]?.results??[];
}
async function active(name) {
  const r=await cf(root+'/workers/scripts/'+name+'/deployments');
  const entry=r.deployments?.[0]?.versions;
  const actual=entry?.length===1&&entry[0].percentage===100?entry[0].version_id:null;
  if(!actual)throw Error('Worker has an unrecognized deployment state: '+name);
  return actual;
}
async function deploy(name,version,reason){
  const r=await cf(root+'/workers/scripts/'+name+'/deployments',{
    method:'POST',
    body:JSON.stringify({strategy:'percentage',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':reason}}),
  });
  if(!r?.id)throw Error('Cloudflare did not return deployment ID for '+name);
  const now=await active(name);
  if(now!==version)throw Error('Wrong active Worker version after deployment: '+name);
  console.log('ACTIVATED '+name+' '+version);
}
for(const c of changes) {
  const got=await active(c.name);
  if(got!==c.before)throw Error('ABORT: '+c.name+' is not on expected original version');
}
const admins=await sql("SELECT lower(email) AS email, is_platform_admin AS is_admin FROM users WHERE disabled_at IS NULL AND lower(email) IN ('haider@relaywa.com','mr.qkay@relaywa.com')");
if(admins.length!==2||admins.some(x=>x.is_admin!==1))throw Error('Protected administrator accounts were not found');
const before=await sql("SELECT code,active,(SELECT COUNT(*) FROM organization_subscriptions os WHERE os.plan_code=sp.code) AS refs FROM subscription_plans sp ORDER BY code");
console.log('PLANS_BEFORE '+JSON.stringify(before));
const enterprise=before.find(x=>x.code==='enterprise');
if(!enterprise||Number(enterprise.refs)<1)throw Error('Existing Enterprise customer plan references did not match expected baseline');
const bookmark=await cf(d1+'/time_travel/bookmark');
if(!bookmark?.bookmark)throw Error('Cloudflare D1 Time Travel must be available');
console.log('RECOVERY_BOOKMARK_CAPTURED true (value not logged)');
const existing=await sql("SELECT sql FROM sqlite_master WHERE type='table' AND name='subscription_plans'");
let schema=String(existing[0]?.sql??'');
if(!schema.includes('available_for_purchase')) {
  await sql('ALTER TABLE subscription_plans ADD COLUMN available_for_purchase INTEGER NOT NULL DEFAULT 1');
  console.log('D1_ADDED available_for_purchase');
}
await sql('CREATE INDEX IF NOT EXISTS idx_relaywa_subscription_available ON subscription_plans(active,available_for_purchase)');
const tally=await sql('SELECT COUNT(*) AS count FROM subscription_plans WHERE available_for_purchase IS NULL');
if(Number(tally[0]?.count)!==0)throw Error('D1 availability default missing');
console.log('D1_MIGRATION_VERIFIED');
const activated=[];
try{
  for(const c of changes){
    await deploy(c.name,c.after,'RelayWA website plan edit, disable, safe delete rollout');
    activated.push(c);
  }
  for(const c of changes)if(await active(c.name)!==c.after)throw Error('Deployment drift '+c.name);
  console.log('DEPLOYMENTS_VERIFIED');
  // Probe public routes without credentials: the new authenticated routes should deny unauthenticated callers.
  let guarded=false;
  for(const host of ['https://platform.relaywa.com','https://relaywa.com']){
    const probe=await fetch(host+'/api/platform/website-plans/enterprise/availability',{method:'PATCH',headers:{'content-type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(12000)});
    console.log('UNAUTHENTICATED_ROUTE '+new URL(host).host+' HTTP '+probe.status);
    if(probe.status===401||probe.status===403)guarded=true;
  }
  if(!guarded)throw Error('Deployed availability route did not enforce authorization as expected');
  const plans=await sql('SELECT code,active,available_for_purchase FROM subscription_plans ORDER BY code');
  if(plans.length!==before.length||plans.some(p=>p.available_for_purchase!==1))throw Error('Plan records changed unexpectedly during deployment');
  console.log('PLANS_AFTER '+JSON.stringify(plans));
  console.log('PRODUCTION_PLAN_CONTROLS_DEPLOYED_SUCCESSFULLY');
}catch(error){
  console.error('ROLLOUT_FAILED '+String(error.message).slice(0,220));
  console.error('ROLLBACK: restoring prior Worker versions (additive D1 column retained)');
  for(const c of [...activated].reverse()) {
    try {await deploy(c.name,c.before,'Automatic rollback of RelayWA plan management rollout');}
    catch(e){console.error('MANUAL_ROLLBACK_REQUIRED '+c.name+' target='+c.before+' '+String(e.message).slice(0,160));}
  }
  throw error;
}
