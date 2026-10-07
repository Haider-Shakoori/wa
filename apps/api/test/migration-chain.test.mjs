import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('migration command includes SaaS auth and auth-provider settings with normal DATABASE_URL quoting', async () => {
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const command=pkg.scripts.migrate;
  assert.match(command,/017_saas_onboarding_auth\.sql/);
  assert.match(command,/018_auth_provider_settings\.sql/);
  assert.doesNotMatch(command,/\\\\\"\$DATABASE_URL/);
  assert.match(command,/psql "\$DATABASE_URL" -f migrations\/018_auth_provider_settings\.sql/);
});
