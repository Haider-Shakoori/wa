import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const policySource = await readFile(new URL('../lib/session-poll-policy.ts', import.meta.url), 'utf8');
const policyJs = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { nextSessionPollDelay } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(policyJs));

test('connected WhatsApp session uses low-frequency status checks', () => {
  assert.equal(nextSessionPollDelay('connected', 0), 60_000);
  assert.equal(nextSessionPollDelay('pending', 0), 4_000);
  assert.equal(nextSessionPollDelay('logged_out', 0), 4_000);
});

test('failed status checks back off instead of hammering the API', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(n => nextSessionPollDelay('connected', n)),
    [15_000, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000, 300_000]);
});

test('session view stops polling in hidden tabs and refreshes after commands', async () => {
  const source = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /document\.visibilityState !== 'visible'/);
  assert.match(source, /addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(source, /removeEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(source, /addEventListener\('relaywa-session-updated', requestRefresh\)/);
  assert.match(source, /window\.dispatchEvent\(new Event\('relaywa-session-updated'\)\)/);
  assert.match(source, /nextSessionPollDelay\(lastStatus, consecutiveFailures\)/);
  assert.doesNotMatch(source, /setInterval\(\(\)=>void poll\(\),2000\)/);
});
