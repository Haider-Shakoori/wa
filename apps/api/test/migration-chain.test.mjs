import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
test('migration runner discovers ordered migrations and excludes obsolete webhook draft',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts.migrate,'node scripts/migrate.mjs');
 const runner=await readFile(new URL('../scripts/migrate.mjs',import.meta.url),'utf8');
 assert.match(runner,/readdir\(directory\)/);assert.match(runner,/\.sort\(\)/);assert.match(runner,/relaywa_schema_migrations/);assert.match(runner,/name!==\'012_webhooks.sql\'/);
 const files=await readdir(new URL('../migrations/',import.meta.url));
 for(const name of ['017_saas_onboarding_auth.sql','018_auth_provider_settings.sql','012_webhooks_delivery.sql','027_direct_message_dispatch.sql'])assert.ok(files.includes(name));
});
