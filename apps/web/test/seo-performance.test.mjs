import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('public marketing and API docs no longer statically import tenant workspace component',()=>{
  const home=read('components/relay-home.tsx');
  const docs=read('app/docs/page.tsx');
  const shared=read('components/marketing-primitives.tsx');
  const workspace=read('components/relay-workspace.tsx');
  assert.match(home,/from '\.\/marketing-primitives'/);
  assert.match(docs,/from '\.\.\/\.\.\/components\/marketing-primitives'/);
  assert.doesNotMatch(home,/from '\.\/relay-workspace'/);
  assert.doesNotMatch(docs,/from '\.\.\/\.\.\/components\/relay-workspace'/);
  assert.match(shared,/export function PlanCards/);
  assert.match(shared,/export function Badge/);
  assert.match(shared,/export function Brand/);
  assert.match(workspace,/export \{ Brand, Badge, PlanCards \}/);
  assert.match(shared,/from 'next\/image'/);
});

test('hero code preview has stable server-rendered content without interval re-render',()=>{
  const home=read('components/relay-home.tsx');
  const body=home.slice(home.indexOf('function TypingApiPreview()'),home.indexOf('export default function RelayHome()'));
  assert.match(body,/aria-label=\{previewCode\}/);
  assert.match(body,/\{previewCode\}/);
  assert.doesNotMatch(body,/setInterval|setTimeout|requestAnimationFrame|useEffect|setVisible/);
});

test('public pages include skip navigation and reduced-motion/focus-visible support',()=>{
  const home=read('components/relay-home.tsx');
  const css=read('app/marketing.css');
  assert.match(home,/href="#main-content"/);
  assert.match(home,/id="main-content"/);
  for(const p of ['app/help/page.tsx','app/pricing/page.tsx','app/docs/page.tsx']){
    assert.match(read(p),/id="main-content"/);
  }
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/min-height:44px/);
});

test('code example tab navigation provides keyboard arrows, home/end and roving focus',()=>{
  const source=read('components/code-showcase.tsx');
  assert.match(source,/role="tablist"/);
  assert.match(source,/ArrowRight/);
  assert.match(source,/ArrowLeft/);
  assert.match(source,/Home/);
  assert.match(source,/End/);
  assert.match(source,/tabIndex=\{language===name\?0:-1\}/);
});

test('CI enforces server HTML and asset budgets while Lighthouse saves mobile reports',()=>{
  const workflow=readFileSync(new URL('../../../.github/workflows/ci.yml',import.meta.url),'utf8');
  const audit=readFileSync(new URL('../../../.github/workflows/seo-lighthouse.yml',import.meta.url),'utf8');
  const smoke=readFileSync(new URL('../../../scripts/seo-perf-budget.mjs',import.meta.url),'utf8');
  const config=JSON.parse(readFileSync(new URL('../../../.lighthouserc.json',import.meta.url),'utf8'));
  assert.match(workflow,/node scripts\/seo-perf-budget\.mjs/);
  assert.match(audit,/treosh\/lighthouse-ci-action@v12/);
  assert.match(audit,/uploadArtifacts: true/);
  assert.match(audit,/temporaryPublicStorage: false/);
  assert.equal(config.ci.collect.settings.formFactor,'mobile');
  assert.ok(config.ci.collect.numberOfRuns>=2);
  assert.ok(smoke.includes('/api-docs'));
  assert.ok(smoke.includes('maxCssGzipBytes'));
  assert.ok(smoke.includes('maxJavascriptGzipBytes'));
});
