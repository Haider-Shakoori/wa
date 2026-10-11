import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFile(new URL('../'+path, import.meta.url),'utf8');

test('optional GSC verification token is independently validated and rejects tag injection', async () => {
  const src = await read('lib/google-site-verification.ts');
  const output = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(output,{ exports });
  const token = exports.googleSiteVerificationToken;
  assert.equal(token(undefined),undefined);
  assert.equal(token(''),undefined);
  assert.equal(token('   '),undefined);
  assert.equal(token('  ABCDEFGHIJKLMNOPqrstuv12345_-  '),'ABCDEFGHIJKLMNOPqrstuv12345_-');
  assert.throws(()=>token('<script>danger</script>'),/GOOGLE_SITE_VERIFICATION/);
  assert.throws(()=>token('google-site-verification=token'),/GOOGLE_SITE_VERIFICATION/);
  assert.throws(()=>token('invalid token with spaces'),/GOOGLE_SITE_VERIFICATION/);
});

test('Next metadata emits an optional HTML verification tag without forcing GA4 tracking', async () => {
  const layout = await read('app/layout.tsx');
  const analytics = await read('components/google-analytics.tsx');
  const env = await readFile(new URL('../../../.env.example',import.meta.url),'utf8');
  const docs = await readFile(new URL('../../../docs/seo/google-ownership-ga4-windsor.md',import.meta.url),'utf8');
  assert.match(layout,/googleSiteVerificationToken\(process\.env\.GOOGLE_SITE_VERIFICATION\)/);
  assert.match(layout,/verification: \{ google: gscVerification \}/);
  assert.match(env,/^GOOGLE_SITE_VERIFICATION=$/m);
  assert.match(analytics,/consent === 'granted' && <Script/);
  assert.match(analytics,/if \(!isPublic\) return null/);
  assert.doesNotMatch(analytics,/google-site-verification|GOOGLE_SITE_VERIFICATION/);
  assert.match(docs,/Domain property/);
  assert.match(docs,/build time/);
  assert.match(docs,/G-61Z26DFM1V/);
  assert.match(docs,/558119248/);
});
