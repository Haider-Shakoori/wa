const { test, expect } = require('@playwright/test');

async function policy(page,value='consent'){
  await page.route('**/analytics-policy',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({policy:value}),
  }));
}

test('no cookie or analytics popup is shown anywhere and Decline prevents GA4 collection',async({page})=>{
  await policy(page);
  const outgoing=[];
  page.on('request',req=>{
    if(/googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:g\/collect|collect)/.test(req.url()))outgoing.push(req.url());
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  await page.getByRole('link',{name:'Analytics preferences'}).click();
  await expect(page.getByRole('heading',{name:'Analytics preferences'})).toBeVisible();
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  await page.getByRole('button',{name:'Disable optional analytics'}).click();
  await expect(page.getByText('Disabled by your choice')).toBeVisible();
  await page.goto('/pricing',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'WhatsApp API pricing'})).toBeVisible();
  expect(outgoing).toHaveLength(0);
});

test('explicit opt-in loads GA4 with correct Consent Mode v2 command queue, persists, and can be revoked',async({page})=>{
  await policy(page);
  const tags=[];
  await page.route(/googletagmanager\.com\/gtag\/js/,async route=>{
    tags.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/javascript',body:'/* intercept Google tag in CI */'});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(tags).toHaveLength(0);
  await page.getByRole('link',{name:'Analytics preferences'}).click();
  await page.getByRole('button',{name:'Enable optional analytics'}).click();
  await expect(page.getByText('Enabled by your choice')).toBeVisible();
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>tags.length).toBe(1);
  await expect.poll(async()=>page.evaluate(()=>
    (window.dataLayer||[]).some(x=>x[0]==='event'&&x[1]==='page_view')?1:0)).toBe(1);
  const rows=await page.evaluate(()=>(window.dataLayer||[]).map(x=>({
    arrayLikeArguments:Object.prototype.toString.call(x)==='[object Arguments]',
    values:Array.from(x)
  })));
  expect(rows.every(x=>x.arrayLikeArguments)).toBe(true);
  const defaults=rows[0].values;
  expect(defaults.slice(0,2)).toEqual(['consent','default']);
  for(const key of ['analytics_storage','ad_storage','ad_user_data','ad_personalization']){
    expect(defaults[2][key]).toBe('denied');
  }
  const grant=rows.find(x=>x.values[0]==='consent'&&x.values[1]==='update'&&x.values[2].analytics_storage==='granted');
  expect(grant).toBeTruthy();
  expect(grant.values[2].ad_storage).toBe('denied');

  await page.getByRole('link',{name:'Analytics preferences'}).click();
  await page.getByRole('button',{name:'Disable optional analytics'}).click();
  await page.goto('/',{waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe('denied');
  expect(await page.evaluate(()=>window['ga-disable-G-61Z26DFM1V'])).toBe(true);
  expect(tags).toHaveLength(1,'declining must prevent a later GA4 tag request');
});
