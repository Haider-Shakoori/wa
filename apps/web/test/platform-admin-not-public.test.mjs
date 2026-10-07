import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public website does not expose platform administration', async () => {
  const home = await readFile(new URL('../components/relay-home.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /platform\.relaywa\.com/);
  assert.doesNotMatch(home, /Platform administration/);
});

test('tenant login does not expose platform administrator sign in', async () => {
  const login = await readFile(new URL('../components/relay-auth.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(login, /platform\.relaywa\.com/);
  assert.doesNotMatch(login, /Platform administrator sign in/);
});
