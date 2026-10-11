const { test, expect } = require('@playwright/test');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const publicRoutes = [
  '/',
  '/pricing',
  '/api-docs',
  '/help',
  '/blog',
  '/blog/nodejs-whatsapp-api-send-webhooks',
  '/blog/laravel-whatsapp-api-order-notifications',
  '/blog/whatsapp-api-qr-session-troubleshooting',
];
const screenshots = new Set(['/', '/pricing', '/api-docs', '/help', '/blog']);
const unpublished = [
  '/countries/india',
  '/countries/brazil',
  '/pt-br', '/es', '/ar',
  '/blog/python-whatsapp-api-webhook-workflow',
  '/blog/dotnet-whatsapp-api-transactional-integration',
  '/blog/official-cloud-api-versus-qr-sessions',
  '/blog/whatsapp-api-provider-comparison',
];

for (const route of publicRoutes) {
  test(`indexable SSR page: ${route}`, async ({ page }, testInfo) => {
    const result = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(result?.status(), `${route} should be HTTP 200`).toBe(200);
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    if (route === '/') {
      expect(canonical).toMatch(/^https:\/\/relaywa\.com\/?$/);
    } else {
      expect(canonical).toBe('https://relaywa.com' + route);
    }
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length || 0, 'Description should have useful copy').toBeGreaterThan(50);
    expect(await page.locator('link[hreflang]').count()).toBe(0);
    if (route.startsWith('/blog/')) {
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
      const json = await page.locator('script[type="application/ld+json"]').textContent();
      expect(json).toContain('TechArticle');
      expect(json).toContain('BreadcrumbList');
      await expect(page.getByText('Last verified', { exact: false }).first()).toBeVisible();
    }
    if (screenshots.has(route)) {
      mkdirSync(join(__dirname, 'screenshots'), { recursive: true });
      const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
      await page.screenshot({
        path: join(__dirname, 'screenshots', `${name}-${testInfo.project.name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test('sitemap only includes reviewed English routes; no draft or country doorway URLs', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const route of publicRoutes) {
    if (route === '/') {
      expect(xml).toMatch(/<loc>https:\/\/relaywa\.com\/?<\/loc>/);
    } else {
      expect(xml).toContain(`<loc>https://relaywa.com${route}</loc>`);
    }
  }
  for (const route of unpublished) expect(xml).not.toContain('https://relaywa.com' + route);
  expect(xml).not.toMatch(/hreflang|\/pt-br|\/es\/|\/countries\//);
});

test('unpublished routes stay HTTP 404/nonindex, and private dashboard is noindex', async ({ request }) => {
  for (const route of unpublished) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), `${route} should be unpublished`).toBe(404);
    expect(response.headers()['x-robots-tag'] || '', route).toMatch(/noindex/);
  }
  const dashboard = await request.get('/dashboard', { maxRedirects: 0 });
  expect(dashboard.headers()['x-robots-tag'] || '').toMatch(/noindex/);
});

test('docs redirect and English-only no-geo-redirect behavior', async ({ request }) => {
  const docs = await request.get('/docs', { maxRedirects: 0 });
  expect([301, 308]).toContain(docs.status());
  expect(docs.headers().location || '').toContain('/api-docs');
  const localized = await request.get('/', {
    maxRedirects: 0,
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  expect(localized.status()).toBe(200);
});

test('help and pricing retain business model / documentation navigation', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: /QR-linked API subscription vs/ })).toBeVisible();
  await expect(page.locator('a[href="/api-docs#queue"]').first()).toBeVisible();
  await page.goto('/help');
  await expect(page.locator('section a[href="/api-docs"]').first()).toBeVisible();
  await expect(page.locator('a[href="/blog"]').first()).toHaveAttribute('href', '/blog');
});
