// Narrow patches for the currently deployed Cloudflare RelayWA Workers.
// Pure transformations: production source is downloaded only in the CI runner.
const assertOne=(src,needle,label)=>{
  const first=src.indexOf(needle);
  if(first<0||src.indexOf(needle,first+needle.length)>=0)throw Error('Unexpected deployed Worker layout: '+label);
  return first;
};
const replaceOne=(src,a,b,label)=>{assertOne(src,a,label);return src.replace(a,b);};
const normalize=s=>String(s).replace(/\r\n/g,'\n');

export function patchPlatform(original) {
  let src=normalize(original);
  // Admin UI lists *all* active plans, even ones disabled for new purchases.
  const listAt=assertOne(src,'async function subscriptionPlans(env) {','platform catalog function');
  const nextAt=src.indexOf('\nasync function ',listAt+25);
  if(nextAt<0)throw Error('Platform plan catalog boundary not found');
  let list=src.slice(listAt,nextAt);
  list=replaceOne(list,'monthly_price_cents, annual_price_cents, currency','monthly_price_cents, annual_price_cents, currency, available_for_purchase','catalog availability property');
  src=src.slice(0,listAt)+list+src.slice(nextAt);
  const point='async function authProviders(env) {';
  assertOne(src,point,'platform auth providers boundary');
  const handlers=`
async function updateWebsitePurchaseAvailability(env, code, body, auth) {
  const reason = String(body?.reason ?? '').trim();
  if(reason.length < 8) return fail(400, 'An audit reason of at least eight characters is required');
  if(typeof body?.availableForPurchase !== 'boolean') return fail(400,'Specify whether new purchases are enabled');
  if(code === 'trial' || code === 'enterprise_b2b') return fail(400,'Reserved plan availability cannot be changed');
  const previous = await one(env.DB, 'SELECT code,name,active,available_for_purchase FROM subscription_plans WHERE code=?', [code]);
  if(!previous || Number(previous.active)!==1) return fail(404,'Website plan not found');
  const updated = await one(env.DB, \`UPDATE subscription_plans SET available_for_purchase=?, updated_at=datetime('now')
    WHERE code=? RETURNING code,name,max_sessions,daily_messages,monthly_messages,max_api_keys,
    monthly_price_cents,annual_price_cents,currency,active,available_for_purchase\`,
    [body.availableForPurchase?1:0,code]);
  await recordAudit(env.DB,auth.sub,'website.plan.availability.updated','subscription_plan',code,
    previous,{...updated,reason,availableForPurchase:body.availableForPurchase});
  return json(updated);
}
async function deleteUnusedWebsitePlan(env, code, body, auth) {
  const reason=String(body?.reason??'').trim();
  if(reason.length<8)return fail(400,'An audit reason of at least eight characters is required');
  if(code === 'trial' || code === 'enterprise_b2b')return fail(400,'Built-in plans cannot be deleted');
  const previous=await one(env.DB,'SELECT code,name,active FROM subscription_plans WHERE code=?',[code]);
  if(!previous)return fail(404,'Website plan not found');
  // Keep billing and workspace references intact. Deletion has a database FK fallback.
  const usage=await one(env.DB,\`SELECT
    (SELECT COUNT(*) FROM organization_subscriptions WHERE plan_code=?) AS subscriptions,
    (SELECT COUNT(*) FROM payments WHERE plan_code=?) AS payments,
    (SELECT COUNT(*) FROM organizations WHERE selected_plan_code=?) AS selected\`,
    [code,code,code]);
  if(Number(usage.subscriptions)||Number(usage.payments)||Number(usage.selected))
    return fail(409,'Plan is referenced by a workspace, subscription or payment; disable new purchases instead');
  const removed=await one(env.DB,\`DELETE FROM subscription_plans
    WHERE code=? AND code NOT IN ('trial','enterprise_b2b')
    AND NOT EXISTS(SELECT 1 FROM organization_subscriptions WHERE plan_code=?)
    AND NOT EXISTS(SELECT 1 FROM payments WHERE plan_code=?)
    AND NOT EXISTS(SELECT 1 FROM organizations WHERE selected_plan_code=?)
    RETURNING code\`,[code,code,code,code]);
  if(!removed)return fail(409,'This plan cannot be deleted because it is in use');
  await recordAudit(env.DB,auth.sub,'website.plan.deleted','subscription_plan',code,previous,{deleted:true,reason});
  return json({code,deleted:true});
}
`;
  src=src.replace(point,handlers+point);
  const route='["PATCH", "/platform/website-plans/:code", ROLE_SA_BILL, async (e, r, a, p) => updateWebsitePlan(e, p[0], await r.req.json().catch(() => null), a)],';
  assertOne(src,route,'website edit route');
  src=src.replace(route,route+`
  ["PATCH", "/platform/website-plans/:code/availability", ROLE_SA_BILL, async (e, r, a, p) => updateWebsitePurchaseAvailability(e,p[0],await r.req.json().catch(() => null),a)],
  ["DELETE", "/platform/website-plans/:code", ROLE_SA, async (e, r, a, p) => deleteUnusedWebsitePlan(e,p[0],await r.req.json().catch(() => null),a)],`);
  return src;
}

export function patchApi(original){
  let src=normalize(original);
  const marker='FROM subscription_plans\n          WHERE active = 1 AND code <> \'enterprise_b2b\'';
  src=replaceOne(src,marker,'FROM subscription_plans\n          WHERE active = 1 AND available_for_purchase = 1 AND code <> \'enterprise_b2b\'','public catalog SQL');
  // Do NOT modify en(getPlan): that function is also used by Stripe renewal webhooks.
  const stripe='  let o = await en(e.env.DB, n.planCode), d = n.billingInterval === "annual" ? o.annual_price_cents : o.monthly_price_cents;';
  src=replaceOne(src,stripe,
    `  if(!await e.env.DB.prepare("SELECT 1 FROM subscription_plans WHERE code=? AND available_for_purchase=1").bind(n.planCode).first())throw new p(409,"This plan is unavailable for new purchases");
`+stripe,'new Stripe checkout guard');
  const manual='  let i = await en(e.env.DB, r.planCode), o = r.billingInterval === "annual" ? i.annual_price_cents : i.monthly_price_cents, d = crypto.randomUUID();';
  src=replaceOne(src,manual,
    `  if(!await e.env.DB.prepare("SELECT 1 FROM subscription_plans WHERE code=? AND available_for_purchase=1").bind(r.planCode).first())throw new p(409,"This plan is unavailable for new purchases");
`+manual,'new manual payment guard');
  return src;
}
