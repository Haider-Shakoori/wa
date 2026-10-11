const { test, expect } = require('@playwright/test');

async function mockPolicy(page, policy) {
  await page.route('**/analytics-policy', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'cache-control': 'private, no-store' },
    body: JSON.stringify({ policy }),
  }));
}

test('eligible region runs GA4 automatically with no popup and a saved opt-out stops new loads', async ({ page }) => {
  await mockPolicy(page,'auto');
  const tags=[];
  await page.route(/googletagmanager\.com\/gtag\/js/,route=>{
    tags.push(route.request().url());
    return route.fulfill({status:200,contentType:'application/javascript',body:'/* mocked Google tag */'});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>tags.length).toBe(1);
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe(null);

  await page.getByRole('link',{name:'Analytics preferences'}).click();
  await expect(page.getByRole('heading',{name:'Analytics preferences'})).toBeVisible();
  await page.getByRole('button',{name:'Disable optional analytics'}).click();
  await expect(page.getByText('Disabled by your choice')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe('denied');

  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  expect(tags).toHaveLength(1);
  expect(await page.evaluate(()=>window['ga-disable-G-61Z26DFM1V'])).toBe(true);
});

test('consent-required region shows no popup and sends no Google requests until explicit opt-in', async ({ page }) => {
  await mockPolicy(page,'consent');
  const tags=[];
  await page.route(/googletagmanager\.com\/gtag\/js/,route=>{
    tags.push(route.request().url());
    return route.fulfill({status:200,contentType:'application/javascript',body:'/* intercepted */'});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  expect(tags).toHaveLength(0);
  await page.getByRole('link',{name:'Analytics preferences'}).click();
  await expect(page.getByText('Disabled until you enable it')).toBeVisible();
  await page.getByRole('button',{name:'Enable optional analytics'}).click();
  await expect(page.getByText('Enabled by your choice')).toBeVisible();
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>tags.length).toBe(1);
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
});

test('unknown or failed region does not silently enable GA4 or display a modal', async ({ page }) => {
  await page.route('**/analytics-policy',route=>route.abort('failed'));
  const tags=[];
  page.on('request',req=>{
    if(/googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect/.test(req.url()))tags.push(req.url());
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Analytics preferences'})).toBeVisible();
  expect(tags).toHaveLength(0);
  expect(await page.evaluate(()=>typeof window.gtag)).toBe('undefined');
});

test('private login never loads public GA4 or consent notices',async({page})=>{
  await mockPolicy(page,'auto');
  const tags=[];
  page.on('request',req=>{if(req.url().includes('googletagmanager.com/gtag/js'))tags.push(req.url())});
  await page.goto('/login',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.rw-analytics-consent')).toHaveCount(0);
  expect(tags).toHaveLength(0);
});
