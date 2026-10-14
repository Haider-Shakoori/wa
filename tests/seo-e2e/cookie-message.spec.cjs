const {test, expect} = require('@playwright/test');

test('@cookie fresh visitor sees non-modal cookie message and choice persists', async ({page}) => {
  await page.goto('/whatsapp-api-qr-code', {waitUntil:'domcontentloaded'});
  const notice = page.locator('#relaywa-cookie-message');
  await expect(notice).toBeVisible();
  await expect(notice.getByText('We use cookies')).toBeVisible();
  await expect(notice.getByRole('button',{name:'Accept optional'})).toBeVisible();
  await expect(notice.getByRole('button',{name:'Reject optional'})).toBeVisible();
  await expect(notice.getByRole('link',{name:'Cookie settings'})).toHaveAttribute('href','/analytics-preferences');
  await notice.getByRole('button',{name:'Reject optional'}).click();
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe('denied');
  await page.goto('/whatsapp-webhooks', {waitUntil:'domcontentloaded'});
  await expect(notice).toHaveCount(0);
  // Existing regional analytics code must not be bypassed by a fake consent click.
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe('denied');
});

test('@cookie accepted optional analytics uses same key and notice stays dismissed',async({page}) => {
  await page.goto('/guides/whatsapp-web-vs-cloud-api',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#relaywa-cookie-message')).toBeVisible();
  await page.getByRole('button',{name:'Accept optional'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('relaywa_analytics_consent'))).toBe('granted');
  await page.goto('/whatsapp-api-qr-code',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#relaywa-cookie-message')).toHaveCount(0);
});

test('@cookie marketing site shows banner without blocking navigation',async({page}) => {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#relaywa-cookie-message')).toBeVisible();
  await expect(page.locator('#relaywa-cookie-message')).not.toHaveCSS('position','absolute');
  await expect(page.getByRole('heading',{name:/We use cookies/i})).toHaveCount(0);
  await expect(page.locator('.rw-cookie-actions button')).toHaveCount(2);
  await page.getByRole('button',{name:'Reject optional'}).click();
  await expect(page.locator('#relaywa-cookie-message')).toHaveCount(0);
});
