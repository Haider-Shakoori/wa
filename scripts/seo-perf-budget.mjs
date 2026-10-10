#!/usr/bin/env node
/**
 * Reproducible HTML/asset-size smoke check against a built Next.js server.
 * Does not replace Lighthouse or real-user Core Web Vitals.
 */
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

const ORIGIN = process.env.SEO_SMOKE_ORIGIN || 'http://127.0.0.1:3000';
const routes = ['/', '/pricing', '/api-docs', '/help'];
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
  assert.match(html, /<h1[\s>]/i, `${route}: missing server-rendered H1`);
  assert.match(html, /<main[\s>]/i, `${route}: missing server-rendered main landmark`);
  assert.match(html, /<meta[^>]+name="description"/i, `${route}: missing server-rendered description`);
  assert.ok(html.includes(`rel="canonical"`) && html.includes(`https://relaywa.com${route==='/'?'/':route}`),
    `${route}: missing correct canonical`);
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
  const privateResponse=await fetch(new URL('/dashboard',ORIGIN),{redirect:'manual'});
  assert.match(privateResponse.headers.get('x-robots-tag')||'',/noindex/,'Private page must stay noindex');
  console.log(JSON.stringify({kind:'seo-lab-build-asset-budget',budgets,pages,totalUniqueAssets:assets.size,
    jsGzipBytes:totals.js,cssGzipBytes:totals.css,note:'Production Next build and compressed transferred assets, NOT Core Web Vitals or Lighthouse scores.'},null,2));
}
await run();
