import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configuredProxyOrigin } from '../lib/cpanel-api-origin.mjs';

test('existing single-server deployment keeps /api local by default', () => {
  assert.equal(configuredProxyOrigin(undefined), null);
  assert.equal(configuredProxyOrigin(''), null);
  assert.equal(configuredProxyOrigin('   '), null);
});

test('cPanel origin config accepts strict HTTPS origins', () => {
  assert.equal(configuredProxyOrigin('https://api-staging.relaywa.com'), 'https://api-staging.relaywa.com');
  assert.equal(configuredProxyOrigin(' https://api.relaywa.com:8443 '), 'https://api.relaywa.com:8443');
});

test('reject unsafe API upstreams', () => {
  for (const value of [
    'http://api.relaywa.com',
    'https://user:secret@api.relaywa.com',
    'https://api.relaywa.com/api',
    'https://api.relaywa.com/?x=1',
    'https://api.relaywa.com/#fragment',
    'file:///tmp/socket',
    'api.relaywa.com',
  ]) {
    assert.throws(() => configuredProxyOrigin(value), /HTTPS origin/);
  }
});

test('Next.js config preserves /api routing via opt-in rewrite only', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /RELAYWA_API_UPSTREAM/);
  assert.match(config, /source: '\/api\/:path\*'/);
  assert.match(config, /destination: `\$\{origin\}\/api\/:path\*`/);
});
