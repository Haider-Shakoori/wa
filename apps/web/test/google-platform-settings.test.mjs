import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Google login configuration is loaded at runtime', async () => {
  const source=await readFile(new URL('../components/google-signin.tsx',import.meta.url),'utf8');
  assert.match(source,/\/auth\/providers/);
  assert.match(source,/google\?\.enabled/);
  assert.doesNotMatch(source,/NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
});

test('platform UI exposes Google authentication settings', async () => {
  const source=await readFile(new URL('../app/platform/page.tsx',import.meta.url),'utf8');
  assert.match(source,/Authentication/);
  assert.match(source,/Google Client ID/);
  assert.match(source,/Save Google settings/);
  assert.match(source,/settings\/auth-providers\/google/);
});
