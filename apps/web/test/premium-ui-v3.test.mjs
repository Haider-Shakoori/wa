import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('premium UI v3 theme is present across app surfaces', async () => {
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /relayWA Premium UI v3/);
  assert.match(css, /\.app-shell\{grid-template-columns:272px/);
  assert.match(css, /\.auth-v2-card\{/);
  assert.match(css, /\.platform-hero\{/);
  assert.match(css, /\.workspace-banner/);
  assert.match(css, /\.state-safety_paused/);
  assert.match(css, /@media\(max-width:720px\)/);
});
