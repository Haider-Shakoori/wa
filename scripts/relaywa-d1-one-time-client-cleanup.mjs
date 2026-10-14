// One-time RelayWA Cloudflare D1 cleanup; never run from production app requests.
// Purpose: retain haider@relaywa.com + mr.qkay@relaywa.com and the workspaces
// necessary for admin authentication; remove all other client records.
// Run only in an authorized GitHub Actions maintenance workflow.
const PROTECTED = ['haider@relaywa.com','mr.qkay@relaywa.com'];
const PROTECTED_SQL = "'haider@relaywa.com','mr.qkay@relaywa.com'";
const mode=process.env.CLEANUP_MODE??'dry-run';
const required='CONFIRM_RELAYWA_D1_CLIENT_CLEANUP_20261014';
if(!['dry-run','execute'].includes(mode))throw Error('Invalid cleanup mode');
if(mode==='execute'){
  if(process.env.CLEANUP_CONFIRM!==required)throw Error('Explicit cleanup confirmation missing');
  if(process.env.GITHUB_REF!=='refs/heads/maintenance/relaywa-d1-audit-20261014')throw Error('Wrong maintenance branch');
}
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Missing Cloudflare credentials');
const root='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const headers={'authorization':'Bearer '+token,'content-type':'application/json'};
async function cf(path,body,timeout=30000){
  const r=await fetch(root+path,{
    method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(timeout)
  });
  const j=await r.json();
  if(!r.ok||!j.success)throw Error('Cloudflare request failed: HTTP '+r.status+', details '+JSON.stringify(j.errors?.map(e=>({code:e.code,message:String(e.message??'').slice(0,360)}))));
  return j.result;
}
const matched=(await cf('?per_page=100')).filter(x=>x.name==='relaywa');
if(matched.length!==1)throw Error('Expected exactly one relaywa D1 database');
const id=matched[0].uuid;
async function query(sql){
  const response=await cf('/'+id+'/query',{sql},60000);
  if(!Array.isArray(response)||response.some(item=>item.success===false))throw Error('D1 query failed');
  return response?.[0]?.results??[];
}
const identity=await query("SELECT lower(email) AS email,is_platform_admin AS admin,platform_role AS role,CASE WHEN disabled_at IS NULL THEN 1 ELSE 0 END AS enabled FROM users WHERE lower(email) IN ("+PROTECTED_SQL+") ORDER BY email");
if(identity.length!==2 || identity.some(r=>!PROTECTED.includes(r.email)||r.admin!==1||r.role!=='super_admin'||r.enabled!==1))throw Error('Protected accounts missing or changed');
const members=await query("SELECT lower(u.email) AS email,count(*) AS n FROM users u JOIN organization_memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE lower(u.email) IN ("+PROTECTED_SQL+") AND m.status='active' AND o.suspended_at IS NULL GROUP BY lower(u.email) ORDER BY email");
if(members.length!==2||members.some(r=>Number(r.n)<1))throw Error('Protected active workspace membership missing');
const orgs=await query("SELECT count(DISTINCT m.organization_id) AS n FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE lower(u.email) IN ("+PROTECTED_SQL+")");
if(Number(orgs[0]?.n)!==2)throw Error('Expected two distinct protected admin workspaces');
const before={};
for(const name of ['users','organizations','organization_memberships','organization_subscriptions','payments','whatsapp_sessions','api_keys','webhook_endpoints','whatsapp_messages','enterprise_accounts']){
  before[name]=Number((await query('SELECT count(*) AS n FROM "'+name+'"'))[0]?.n??-1);
}
if(before.users<2||before.organizations<2)throw Error('Unexpected pre-delete database counts');
console.log('TARGET_DATABASE relaywa');
console.log('PROTECTED_LOGINS '+identity.map(x=>x.email).join(' + '));
console.log('ACTIVE_ADMIN_WORKSPACES '+orgs[0].n);
console.log('BEFORE_COUNTS '+JSON.stringify(before));
const plannedGlobal=[
 'enterprise_api_keys','enterprise_clients','enterprise_embed_grants','enterprise_invitations','enterprise_accounts',
 'webhook_deliveries','webhook_endpoints',
 'whatsapp_chats','whatsapp_contacts','whatsapp_groups','whatsapp_messages',
 'whatsapp_session_commands','whatsapp_session_events','api_keys','system_alerts','whatsapp_sessions',
 'payments','subscription_usage','billing_notification_outbox',
 'admin_password_reset_links','oauth_login_codes','auth_login_attempt_windows',
 'platform_mfa_challenges'
];
const existing=(await query("SELECT name FROM sqlite_master WHERE type='table'")).map(x=>x.name);
for(const table of plannedGlobal)if(!existing.includes(table))throw Error('Missing expected table: '+table);
const sql=plannedGlobal.map(table=>'DELETE FROM "'+table+'"');
sql.push("DELETE FROM user_login_sessions WHERE user_id NOT IN (SELECT id FROM users WHERE lower(email) IN ("+PROTECTED_SQL+"))");
sql.push("DELETE FROM user_auth_identities WHERE user_id NOT IN (SELECT id FROM users WHERE lower(email) IN ("+PROTECTED_SQL+"))");
sql.push("DELETE FROM organization_subscriptions WHERE organization_id NOT IN (SELECT m.organization_id FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE lower(u.email) IN ("+PROTECTED_SQL+"))");
sql.push("DELETE FROM organization_memberships WHERE user_id NOT IN (SELECT id FROM users WHERE lower(email) IN ("+PROTECTED_SQL+"))");
sql.push("DELETE FROM organizations WHERE id NOT IN (SELECT m.organization_id FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE lower(u.email) IN ("+PROTECTED_SQL+"))");
sql.push("DELETE FROM users WHERE lower(email) NOT IN ("+PROTECTED_SQL+")");
console.log('PLANNED_STATEMENTS '+sql.length);
console.log('PRESERVE platform settings, subscription plans, two admin users, two admin memberships, two admin organizations, their subscription scaffolding, platform security/audit history');
if(mode==='dry-run'){
  console.log('DRY_RUN_SUCCESS_NO_WRITES');
  process.exit(0);
}
const snapshot=await cf('/'+id+'/time_travel/bookmark');
if(!snapshot?.bookmark)throw Error('A restorable D1 bookmark is mandatory');
console.log('BEFORE_DELETION_TIME_TRAVEL_BOOKMARK '+snapshot.bookmark);
console.log('BOOKMARK_RESTORE_REFERENCE Cloudflare D1 time travel restore requires account credentials; bookmark only');
console.log('DELETING_CLIENT_DATA');
try {
  const result=await cf('/'+id+'/query',{sql:sql.join(';\n')+';'},120000);
  if(!Array.isArray(result)||result.some(x=>x.success===false))throw Error('Multi-statement delete returned a failed statement');
  const finalUsers=await query('SELECT lower(email) AS email,is_platform_admin AS admin,CASE WHEN disabled_at IS NULL THEN 1 ELSE 0 END AS enabled FROM users ORDER BY email');
  if(finalUsers.length!==2||finalUsers.some(x=>!PROTECTED.includes(x.email)||x.admin!==1||x.enabled!==1))throw Error('Post-cleanup users check FAILED');
  const after={};
  for(const name of Object.keys(before))after[name]=Number((await query('SELECT count(*) AS n FROM "'+name+'"'))[0]?.n??-1);
  if(after.users!==2||after.organizations!==2||after.organization_memberships!==2||after.payments!==0||after.whatsapp_sessions!==0||after.webhook_endpoints!==0||after.api_keys!==0||after.whatsapp_messages!==0||after.enterprise_accounts!==0)throw Error('Post-cleanup cardinality check FAILED: '+JSON.stringify(after));
  const finalMembers=await query("SELECT lower(u.email) AS email,count(*) AS n FROM users u JOIN organization_memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id WHERE lower(u.email) IN ("+PROTECTED_SQL+") AND m.status='active' AND o.suspended_at IS NULL GROUP BY lower(u.email) ORDER BY email");
  if(finalMembers.length!==2)throw Error('Post-cleanup admin login memberships missing');
  console.log('AFTER_COUNTS '+JSON.stringify(after));
  console.log('RELAYWA_D1_CLIENT_CLEANUP_VERIFIED_SUCCESS');
} catch(e) {
  console.error('DELETION_OR_VERIFICATION_FAILED '+e.message);
  console.error('RECOVER_USING_PRE_DELETION_BOOKMARK '+snapshot.bookmark);
  // Do not automatically roll back time-travel: restores overwrite all later concurrent changes.
  throw e;
}
