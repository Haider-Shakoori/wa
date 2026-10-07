import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  ['dashboard', '../components/relay-workspace.tsx'],
  ['platform', '../app/platform/page.tsx'],
  ['onboarding', '../app/onboarding/page.tsx'],
];

for (const [name, path] of pages) {
  test(`${name} provides account sign out`, async () => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /localStorage\.removeItem\('relaywa_access_token'\)/);
    assert.match(source, /Sign out/);
    if (name === 'platform') assert.match(source, /router\.replace\('\/platform\/login'\)/);
    else assert.match(source, /router\.replace\('\/login'\)/);
  });
}

test('dashboard and platform redirect to their own login surfaces when no token exists', async () => {
  const dashboard = await readFile(new URL('../components/relay-workspace.tsx', import.meta.url), 'utf8');
  const platform = await readFile(new URL('../app/platform/page.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /if\s*\(!current\)[\s\S]*router\.replace\('\/login'\)/);
  assert.match(platform, /if\s*\(!current\)[\s\S]*router\.replace\('\/platform\/login'\)/);
});
