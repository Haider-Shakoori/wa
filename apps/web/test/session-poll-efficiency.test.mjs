import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const policySource = await readFile(new URL('../lib/session-poll-policy.ts', import.meta.url), 'utf8');
const viewSource = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
const streamSource = await readFile(new URL('../lib/session-events.ts', import.meta.url), 'utf8');

test('normal status changes use an authenticated event stream, never 60-second polling', () => {
  assert.match(viewSource, /watchSessionEvents\(/);
  assert.match(viewSource, /event\.type\.startsWith\('session\.'\)/);
  assert.match(streamSource, /authorization: 'Bearer ' \+ token/);
  assert.doesNotMatch(viewSource, /setInterval\(\(\)=>void poll\(\),2000\)/);
  assert.doesNotMatch(policySource, /60_000|CONNECTED_SESSION_POLL/);
});

test('unavailable event streams fall back to the original 2-second responsiveness', () => {
  assert.match(policySource, /SESSION_FALLBACK_POLL_MS = 2_000/);
  assert.match(policySource, /SESSION_STREAM_STALE_MS = 35_000/);
  assert.match(viewSource, /schedulePoll\(SESSION_FALLBACK_POLL_MS\)/);
  assert.match(viewSource, /onVisibilityChange/);
  assert.match(viewSource, /document\.visibilityState !== 'visible'/);
  assert.match(viewSource, /window\.dispatchEvent\(new Event\('relaywa-session-updated'\)\)/);
});

test('SSE stream parses actual lifecycle events without requesting on heartbeats', async () => {
  const runtimeSource = streamSource
    .replace("import { API_BASE } from './api';", "const API_BASE = '/api';")
    .replace("import { expireBrowserSession } from './session-expiry';", "const expireBrowserSession = () => {};");
  const js = ts.transpileModule(runtimeSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { watchSessionEvents } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(js));
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    const event = { id: '1', type: 'session.reconnecting', payload: {}, createdAt: '2026-10-15' };
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'event: relaywa.heartbeat\ndata: []\n\n' +
            'event: relaywa.events\ndata: ' + JSON.stringify([event]) + '\n\n'));
          controller.close();
        },
      }), { headers: { 'content-type': 'text/event-stream' } });
    };
    const received = [];
    let opened = 0;
    let activity = 0;
    await assert.rejects(watchSessionEvents({
      sessionId: 'session-1',
      token: 'test-only-token',
      signal: new AbortController().signal,
      onOpen: () => { opened++; },
      onActivity: () => { activity++; },
      onEvents: events => received.push(...events),
    }), /stream ended/);
    assert.equal(opened, 1);
    assert.equal(activity, 2);
    assert.deepEqual(received, [event]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/whatsapp-sessions/session-1/events');
    assert.equal(calls[0].options.headers.authorization, 'Bearer test-only-token');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
