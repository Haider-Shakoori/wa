import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const paths = ['/whatsapp-api-qr-code', '/whatsapp-webhooks', '/guides/whatsapp-web-vs-cloud-api'];
const appRoot = resolve('apps/web');
const outputDir = resolve('ops/seo-overlay/dist');
const base = process.env.SNAPSHOT_ORIGIN ?? 'http://127.0.0.1:3000';
const templates = {};
function dataInlineCss(css) {
  return css.replace(/url\((["']?)([^)"']+)\1\)/g, (whole, _quote, url) => {
    if (!url.startsWith('../media/') && !url.startsWith('/_next/static/media/')) return whole;
    const filename = url.split('/').at(-1)?.split('?')[0];
    if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) return whole;
    const file = join(appRoot, '.next/static/media', filename);
    if (!existsSync(file)) throw new Error('Missing critical CSS asset: ' + filename);
    const suffix = filename.split('.').at(-1);
    const mime = suffix === 'woff2' ? 'font/woff2' : suffix === 'woff' ? 'font/woff' :
      suffix === 'svg' ? 'image/svg+xml' : suffix === 'png' ? 'image/png' : 'application/octet-stream';
    return 'url("data:' + mime + ';base64,' + readFileSync(file).toString('base64') + '")';
  });
}
function flattenAssets(html) {
  // Inline generated Next CSS so the overlay does not depend on assets from a
  // different production Worker build.
  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, tag => {
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href?.startsWith('/_next/static/') || !href.endsWith('.css')) return tag;
    const filename = href.slice('/_next/static/'.length);
    if (!/^[a-zA-Z0-9._/-]+\.css$/.test(filename) || filename.includes('..')) {
      throw new Error('Invalid CSS filename: ' + href);
    }
    const file = join(appRoot, '.next/static', filename);
    assert.ok(existsSync(file), 'Cannot embed Next production CSS: ' + file);
    const css = dataInlineCss(readFileSync(file, 'utf8')).replace(/<\/style/gi, '<\\/style');
    return '<style data-relaywa-css="inlined">' + css + '</style>';
  });
  html = html.replace(/<link\b[^>]*\brel=["'](?:modulepreload|preload)["'][^>]*>/gi, '');
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag =>
    /\btype=["']application\/ld\+json["']/i.test(tag) ? tag : '');
  // Next RSC client payload is unnecessary on static informational pages.
  html = html.replace(/<noscript><\/noscript>/gi, '');
  return html;
}
for (const path of paths) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Next production page status: ' + path);
  const rendered = await response.text();
  const html = flattenAssets(rendered);
  assert.match(html, /<html[^>]*lang="en"/i, 'English document: ' + path);
  assert.match(html, /<h1(?:\s|>)/i, 'SEO heading: ' + path);
  assert.equal((html.match(/<h1(?:\s|>)/gi) ?? []).length, 1, 'Exactly one H1: ' + path);
  assert.ok(html.includes('href="https://relaywa.com' + path + '"'), 'Canonical: ' + path);
  assert.ok(html.includes('application/ld+json'), 'WebPage structured data: ' + path);
  assert.ok(!html.includes('self.__next_f'), 'No stray hydration script: ' + path);
  assert.ok(!/<script\b(?![^>]*application\/ld\+json)/i.test(html), 'No app JS: ' + path);
  assert.ok(html.length > 3500 && html.length < 1_000_000, 'Unexpected snapshot size: ' + path);
  templates[path] = html;
  console.log('SSR snapshot validated:', path, 'bytes=', html.length);
}
const worker = readFileSync(resolve('ops/seo-overlay/worker-template.mjs'), 'utf8');
const token = '__SEO_HTML_MAP__';
assert.equal(worker.split(token).length, 2, 'One payload replacement location');
mkdirSync(outputDir, { recursive: true });
const cookieJs = readFileSync(resolve('ops/seo-overlay/cookie-message.js'), 'utf8');
const cookieCss = readFileSync(resolve('ops/seo-overlay/cookie-message.css'), 'utf8');
assert.ok(cookieJs.includes('relaywa_analytics_consent') &&
  cookieJs.includes('relaywa:analytics-choice-changed'), 'Cookie choices must use the current analytics preference contract');
assert.ok(!cookieJs.includes('googletagmanager.com'), 'Notice must not load Google scripts');
assert.equal(worker.split('__COOKIE_JS__').length, 2, 'Exactly one cookie JS build token');
assert.equal(worker.split('__COOKIE_CSS__').length, 2, 'Exactly one cookie CSS build token');
const result = worker.replace(token, JSON.stringify(templates))
  .replace('__COOKIE_JS__', JSON.stringify(cookieJs))
  .replace('__COOKIE_CSS__', JSON.stringify(cookieCss));
writeFileSync(join(outputDir, 'index.mjs'), result, 'utf8');
console.log('Isolated SEO Worker compiled; no tenant or existing Worker assets were changed.');
