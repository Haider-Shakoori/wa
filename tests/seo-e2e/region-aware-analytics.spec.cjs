const { test, expect } = require('@playwright/test');

async function mockPolicy(page, policy) {
  await page.route('**/analytics-policy', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'cache-control': 'private, no-store' },
    body: JSON.stringify({ policy }),
  }));
}

test('approved region enables analytics automatically, but user can decline and refusal persists', async ({ page }) => {
  await mockPolicy(page, 'auto');
  const googleTags = [];
  await page.route(/googletagmanager\.com\/gtag\/js/, async route => {
    googleTags.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* intercepted for CI */' });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => googleTags.length).toBe(1);
  const prefs = page.getByRole('region', { name: 'Analytics preferences' });
  await expect(prefs).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('relaywa_analytics_consent'))).toBe(null);
  await page.getByRole('button', { name: 'Analytics preferences' }).click();
  await expect(prefs).toBeVisible();
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(prefs).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('relaywa_analytics_consent'))).toBe('denied');
  expect(await page.evaluate(() => window['ga-disable-G-61Z26DFM1V'])).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(prefs).toHaveCount(0);
  expect(googleTags).toHaveLength(1, 'Explicit refusal prevents reloading Google on revisits');
});

test('unknown or unreviewed region requires explicit consent and no Google tags before choice', async ({ page }) => {
  await mockPolicy(page, 'consent');
  const outbound = [];
  page.on('request', request => {
    if (/googletagmanager\.com\/gtag\/js|google-analytics\.com\/g\/collect/.test(request.url())) {
      outbound.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Analytics preferences' })).toBeVisible();
  expect(outbound).toHaveLength(0);
  await page.getByRole('button', { name: 'Decline' }).click();
  await page.goto('/pricing');
  expect(outbound).toHaveLength(0);
});

test('policy resolution error requires consent instead of silently permitting Google', async ({ page }) => {
  await page.route('**/analytics-policy', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Analytics preferences' })).toBeVisible();
  expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined');
});

test('regional auto mode never tracks private workspace URLs', async ({ page }) => {
  await mockPolicy(page, 'auto');
  const google = [];
  page.on('request', request => {
    if (request.url().includes('googletagmanager.com/gtag/js')) google.push(request.url());
  });
  await page.goto('/login');
  await expect.poll(() => page.locator('main').count()).toBeGreaterThan(0);
  expect(google).toHaveLength(0);
});
