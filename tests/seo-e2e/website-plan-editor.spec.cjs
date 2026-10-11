const {test,expect}=require('@playwright/test');

const original={
 code:'starter',name:'Basic',max_sessions:1,daily_messages:null,
 monthly_messages:30000,max_api_keys:5,monthly_price_cents:399,
 annual_price_cents:4070,currency:'USD',active:true,
};

async function loadAdmin(page,{rejectUpdate=false}={}){
 let catalog=[{...original}],patches=[];
 await page.addInitScript(()=>{
   // The client session watcher requires a structurally valid, non-expired
   // JWT payload even when backend requests are mocked in browser CI.
   const payload=btoa(JSON.stringify({sub:'ci-billing-admin',exp:Math.floor(Date.now()/1000)+3600}))
     .replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');
   window.localStorage.setItem('relaywa_access_token','ci.'+payload+'.test-signature');
 });
 await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,method=req.method();
   const json=(body,status=200)=>route.fulfill({
     status,contentType:'application/json',body:JSON.stringify(body),
   });
   if(p.endsWith('/platform/whoami'))return json({role:'billing_admin'});
   if(p.endsWith('/platform/subscription-plans'))return json(catalog);
   if(p.endsWith('/platform/website-plans/starter') && method==='PATCH'){
     const payload=req.postDataJSON();
     patches.push(payload);
     if(rejectUpdate)return json({message:'Website plan update rejected by server'},400);
     catalog=catalog.map(p=>p.code!=='starter'?p:{
       ...p,name:payload.name,max_sessions:payload.maxSessions,max_api_keys:payload.maxApiKeys,
       monthly_price_cents:payload.monthlyPriceCents,annual_price_cents:payload.annualPriceCents,
       daily_messages:payload.dailyMessages,monthly_messages:payload.monthlyMessages,
     });
     return json(catalog[0]);
   }
   if(p.endsWith('/platform/overview'))return json({});
   if(p.endsWith('/platform/tenants') || p.endsWith('/platform/sessions') ||
     p.endsWith('/platform/subscriptions') || p.endsWith('/platform/workers') ||
     p.endsWith('/platform/payments') || p.endsWith('/billing/providers') ||
     p.endsWith('/platform/settings/auth-providers') ||
     p.endsWith('/platform/audit-logs'))return json([]);
   if(p.endsWith('/platform/settings/messaging-safety'))return json({});
   if(p.endsWith('/platform/settings/messaging-engine'))return json({defaultEngine:'baileys'});
   if(p.endsWith('/platform/queues'))return json({});
   if(p.includes('/platform/errors'))return json([]);
   if(p.endsWith('/platform/analytics'))return json({});
   return json([]);
 });
 await page.goto('/platform',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('button',{name:'Website subscriptions'})).toBeAttached();
 const menu=page.locator('.platform-mobile-menu-toggle');
 if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name:'Website subscriptions'}).click();
 await expect(page.getByText('Website subscription plans',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Edit plan'})).toBeVisible();
 return {patches,catalog:()=>catalog};
}

test('billing admin can edit website plan, then read saved prices from API',async({page})=>{
 const state=await loadAdmin(page);
 await page.getByRole('button',{name:'Edit plan'}).click();
 const editor=page.getByRole('region',{name:'Edit website plan Basic'});
 await expect(editor).toBeVisible();
 await editor.getByLabel('Monthly price (USD)').fill('6.49');
 await editor.getByLabel('Annual price (USD)').fill('65.00');
 await editor.getByLabel('Audit reason').fill('Updated public pricing based on review');
 await editor.getByRole('button',{name:'Save website plan'}).click();
 await expect.poll(()=>state.patches.length).toBe(1);
 expect(state.patches[0]).toMatchObject({
   code:'starter',monthlyPriceCents:649,annualPriceCents:6500,
   currency:'USD',
 });
 await expect(editor).toHaveCount(0);
 await expect(page.getByText(/Website plan saved and verified from the server/)).toBeVisible();
 await expect(page.getByText('$6.49',{exact:false})).toBeVisible();
});

test('rejected PATCH displays error, does not claim success, and keeps editor open',async({page})=>{
 const state=await loadAdmin(page,{rejectUpdate:true});
 await page.getByRole('button',{name:'Edit plan'}).click();
 const editor=page.getByRole('region',{name:'Edit website plan Basic'});
 await editor.getByLabel('Monthly price (USD)').fill('7.49');
 await editor.getByLabel('Audit reason').fill('Testing rejected plan change');
 await editor.getByRole('button',{name:'Save website plan'}).click();
 await expect.poll(()=>state.patches.length).toBe(1);
 await expect(editor.getByRole('alert')).toContainText('Website plan update rejected by server');
 await expect(editor).toBeVisible();
 await expect(page.getByText('Website plan saved and verified from the server')).toHaveCount(0);
});
