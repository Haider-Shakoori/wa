const { test, expect } = require('@playwright/test');

test('GA4 is absent before consent and remains absent after Decline, even across pages', async ({ page }) => {
  const googleRequests = [];
  page.on('request', request => {
    if (/googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:g\/collect|collect)/.test(request.url())) {
      googleRequests.push(request.url());
    }
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const banner = page.getByRole('region', { name: 'Analytics preferences' });
  await expect(banner).toBeVisible();
  expect(googleRequests, 'No Google requests before opt-in').toHaveLength(0);
  expect(await page.evaluate(() => Boolean(window.gtag))).toBe(false);
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(banner).toHaveCount(0);
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'WhatsApp API pricing' })).toBeVisible();
  expect(googleRequests, 'No Google requests when declined').toHaveLength(0);
  expect(await page.evaluate(() => Boolean(window.gtag))).toBe(false);
});

test('Consent Mode v2 denies all by default, grants analytics only after opt-in, and allows revocation', async ({ page }) => {
  const googleTagRequests = [];
  await page.route(/googletagmanager\.com\/gtag\/js/, async route => {
    googleTagRequests.push(route.request().url());
    // Deterministic mock of Google tag loading. We check the queued commands
    // and never send a measurement hit from a CI test browser to real GA4.
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* Google tag intercepted in CI */' });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const banner = page.getByRole('region', { name: 'Analytics preferences' });
  await expect(banner).toBeVisible();
  expect(googleTagRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect(banner).toHaveCount(0);
  await expect.poll(() => googleTagRequests.length).toBe(1);
  await expect.poll(async () => page.evaluate(() => {
    const rows = window.dataLayer || [];
    return rows.some(x => x[0] === 'event' && x[1] === 'page_view') ? 1 : 0;
  })).toBe(1);

  const rows = await page.evaluate(() => (window.dataLayer || []).map(x => Array.from(x)));
  expect(rows[0][0]).toBe('consent');
  expect(rows[0][1]).toBe('default');
  for (const key of ['analytics_storage','ad_storage','ad_user_data','ad_personalization']) {
    expect(rows[0][2][key]).toBe('denied');
  }
  const grant = rows.find(x => x[0] === 'consent' && x[1] === 'update' && x[2].analytics_storage === 'granted');
  expect(grant).toBeTruthy();
  for (const key of ['ad_storage','ad_user_data','ad_personalization']) {
    expect(grant[2][key]).toBe('denied');
  }
  const config = rows.find(x => x[0] === 'config');
  expect(config[1]).toBe('G-61Z26DFM1V');
  expect(config[2].send_page_view).toBe(false);
  const firstView = rows.find(x => x[0] === 'event' && x[1] === 'page_view');
  expect(firstView[2].page_location).toMatch(/^http:\/\/127\.0\.0\.1:3000\/$/);
  await page.getByRole('button', { name: 'Analytics preferences' }).click();
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Decline' }).click();
  await expect(banner).toHaveCount(0);
  const finalState = await page.evaluate(() => (window.dataLayer || []).slice().reverse()
    .find(x => x[0] === 'consent' && x[1] === 'update'));
  expect(finalState[2].analytics_storage).toBe('denied');
  expect(await page.evaluate(() => window['ga-disable-G-61Z26DFM1V'])).toBe(true);
});
