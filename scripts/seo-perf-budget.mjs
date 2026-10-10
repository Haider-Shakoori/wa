#!/usr/bin/env node
/**
 * Reproducible HTML/asset-size smoke check against a built Next.js server.
 * Does not replace Lighthouse or real-user Core Web Vitals.
 */
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const ORIGIN = process.env.SEO_SMOKE_ORIGIN || 'http://127.0.0.1:3000';
const routes = ['/', '/pricing', '/api-docs', '/help', '/blog', '/blog/nodejs-whatsapp-api-send-webhooks', '/blog/laravel-whatsapp-api-order-notifications'];
const budgets = {
  maxHtmlGzipBytes: 60_000,
  maxJavascriptGzipBytes: 320_000,
  maxCssGzipBytes: 75_000,
};
const assets = new Map();
async function visit(route) {
  const url = new URL(route, ORIGIN);
  const response = await fetch(url, { redirect:'manual', headers:{accept:'text/html', 'user-agent':'RelayWA-SEO-CI/1.0'} });
  assert.equal(response.status, 200, `${route} must render an HTTP 200 document`);
  const html = await response.text();
  const htmlBytes = gzipSync(html).length;
  assert.ok(htmlBytes <= budgets.maxHtmlGzipBytes, `${route}: HTML gzip size ${htmlBytes} exceeds budget`);
  assert.match(html, /<html[^>]+lang="en"/i, `${route}: wrong HTML language`);
  assert.doesNotMatch(html, /<link\\b[^>]*\\bhreflang\\s*=/i,
    `${route}: no localized alternates exist; do not advertise fake hreflang`);
  assert.match(html, /<h1[\s>]/i, `${route}: missing server-rendered H1`);
  assert.match(html, /<main[\s>]/i, `${route}: missing server-rendered main landmark`);
  assert.match(html, /<meta[^>]+name="description"/i, `${route}: missing server-rendered description`);
  assert.ok(html.includes(`rel="canonical"`) && html.includes(`https://relaywa.com${route==='/'?'/':route}`),
    `${route}: missing correct canonical`);
  // The existing documentation anchors and trial CTA must be visible in
  // server-rendered HTML, not just after client-side hydration.
  const docAnchors = ['quickstart', 'sessions', 'messages', 'webhooks', 'queue'];
  if (route === '/api-docs') {
    for (const id of docAnchors) {
      assert.ok(html.includes(`id="${id}"`), `Missing canonical docs section #${id}`);
      assert.ok(html.includes(`href="#${id}"`), `Missing in-document navigation to #${id}`);
    }
    assert.ok(html.includes('href="/register"'), 'Docs trial CTA must lead to registration');
  } else if (['/', '/pricing', '/help'].includes(route)) {
    const required = route === '/' ? docAnchors : route === '/pricing' ?
      ['sessions', 'webhooks', 'queue'] : ['quickstart', 'sessions', 'webhooks'];
    for (const id of required) {
      assert.ok(html.includes(`href="/api-docs#${id}"`),
        `${route} must link to existing documentation section #${id}`);
    }
  }
  // Country-intent SEO clarifies plan models on an existing canonical English page.
  if (route === '/pricing') {
    assert.ok(html.includes('id="pricing-model-heading"'),
      'Pricing model difference must be present in SSR HTML');
    assert.ok(html.includes('QR-linked API subscription vs.'),
      'Pricing must distinguish QR-linked sessions from official Meta Cloud API');
    assert.ok(html.includes('https://whatsappbusiness.com/products/platform-pricing/'),
      'Pricing must link to official Meta fee information');
    assert.ok(html.includes('href="/api-docs#queue"'),
      'Pricing should link directly to accurate outbound send/retry documentation');
  }
  if (route === '/blog') {
    for (const slug of ['nodejs-whatsapp-api-send-webhooks','laravel-whatsapp-api-order-notifications']) {
      assert.ok(html.includes(`href="/blog/${slug}"`), 'Unlinked tutorial '+slug);
    }
  }
  if (route.startsWith('/blog/')) {
    assert.ok(html.includes('application/ld+json'), 'Published tutorial needs structured data');
    assert.ok(html.includes('TechArticle') && html.includes('BreadcrumbList'), 'Article and breadcrumbs not rendered');
    assert.ok(html.includes('not Meta') || html.includes('not Meta'), 'Missing correct product-model disclosure');
    assert.ok(html.includes('Last verified'), 'Article needs source verification date');
    assert.ok(html.includes('href="/api-docs#webhooks"'), 'Tutorial must link to existing webhook docs');
  }
  // Framework-specific search intent resolves to server-rendered headings
  // and code inside the ONE existing indexable /api-docs document.
  const frameworkGuides=['integration-nodejs','integration-laravel',
    'integration-python','integration-dotnet','integration-n8n'];
  if(route==='/api-docs'){
    for(const id of frameworkGuides){
      assert.ok(html.includes(`id="${id}"`),`Missing published framework anchor #${id}`);
      assert.ok(html.includes(`href="#${id}"`),`Missing framework navigation #${id}`);
    }
    assert.ok(html.includes('https://relaywa.com/api/send-message'),
      'Developer examples must show public absolute API origin');
  }
  if(route==='/'){
    for(const id of ['integration-nodejs','integration-laravel','integration-python','integration-n8n']){
      assert.ok(html.includes(`href="/api-docs#${id}"`),
        `Homepage framework card does not reach published docs #${id}`);
    }
  }
  const refs = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)];
  for (const [, pathname] of refs) assets.set(pathname, pathname.endsWith('.css')?'css':'js');
  return { path:route, status:response.status, htmlGzipBytes:htmlBytes, assetRefs:refs.length };
}
async function run() {
  const pages=[];
  for (const path of routes) pages.push(await visit(path));
  assert.ok(assets.size>0, 'Expected production JS/CSS assets');
  const totals={js:0,css:0};
  for (const [pathname,type] of assets) {
    const res=await fetch(new URL(pathname,ORIGIN));
    assert.equal(res.status,200,`Missing asset ${pathname}`);
    const compressed=gzipSync(Buffer.from(await res.arrayBuffer())).length;
    totals[type]+=compressed;
  }
  assert.ok(totals.js<=budgets.maxJavascriptGzipBytes,`JS gzip ${totals.js} > ${budgets.maxJavascriptGzipBytes}`);
  assert.ok(totals.css<=budgets.maxCssGzipBytes,`CSS gzip ${totals.css} > ${budgets.maxCssGzipBytes}`);
  const docsRedirect=await fetch(new URL('/docs',ORIGIN),{redirect:'manual'});
  assert.ok([301,308].includes(docsRedirect.status),'Legacy docs should permanently redirect');
  assert.match(docsRedirect.headers.get('location')||'',/\/api-docs$/);
  // English-only country candidates are research, never indexable placeholders.
  // Do not silently redirect based on browser language or country selection.
  const nonPublished = ['/countries/india', '/countries/brazil', '/pt-br', '/es', '/ar'];
  for (const route of nonPublished) {
    const missing = await fetch(new URL(route, ORIGIN), { redirect:'manual',
      headers: { accept:'text/html', 'accept-language':'pt-BR,pt;q=0.9' } });
    assert.equal(missing.status, 404, `${route} must stay unpublished (HTTP 404)`);
    assert.match(missing.headers.get('x-robots-tag')||'',/noindex/,
      `${route} should stay nonindexable`);
  }
  // Draft /integrations/ routes must not compete with the existing API docs.
  for(const route of ['/integrations/laravel','/integrations/python','/integrations/n8n']){
    const response=await fetch(new URL(route,ORIGIN),{redirect:'manual'});
    assert.equal(response.status,404,`Do not publish duplicate framework doorway page ${route}`);
    assert.match(response.headers.get('x-robots-tag')||'',/noindex/);
  }
  const localizedHome = await fetch(new URL('/', ORIGIN), { redirect:'manual',
    headers: { accept:'text/html', 'accept-language':'es-MX,es;q=0.8' } });
  assert.equal(localizedHome.status, 200, 'Do not redirect the global English homepage by locale');
  const privateResponse=await fetch(new URL('/dashboard',ORIGIN),{redirect:'manual'});
  assert.match(privateResponse.headers.get('x-robots-tag')||'',/noindex/,'Private page must stay noindex');
  console.log(JSON.stringify({kind:'seo-lab-build-asset-budget',budgets,pages,totalUniqueAssets:assets.size,
    jsGzipBytes:totals.js,cssGzipBytes:totals.css,note:'Production Next build and compressed transferred assets, NOT Core Web Vitals or Lighthouse scores.'},null,2));
}
await run();
