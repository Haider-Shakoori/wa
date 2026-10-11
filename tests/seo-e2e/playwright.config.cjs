const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.cjs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 2,
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.SEO_E2E_ORIGIN || 'http://127.0.0.1:3000',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: {
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    } },
  ],
});
