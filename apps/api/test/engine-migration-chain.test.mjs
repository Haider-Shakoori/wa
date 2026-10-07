import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production migration chain includes engine migrations', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.migrate, /019_messaging_engine_settings\.sql/);
  assert.match(pkg.scripts.migrate, /020_session_engine_handover\.sql/);
  assert.match(pkg.scripts.migrate, /021_system_alerts\.sql/);
  assert.match(pkg.scripts.migrate, /022_messaging_safety_governor\.sql/);
  assert.match(pkg.scripts.migrate, /023_subscription_catalog_v2\.sql/);
  assert.ok(
    pkg.scripts.migrate.indexOf('019_messaging_engine_settings.sql')
      < pkg.scripts.migrate.indexOf('020_session_engine_handover.sql'),
  );
  assert.ok(
    pkg.scripts.migrate.indexOf('020_session_engine_handover.sql')
      < pkg.scripts.migrate.indexOf('021_system_alerts.sql'),
  );
  assert.ok(
    pkg.scripts.migrate.indexOf('021_system_alerts.sql')
      < pkg.scripts.migrate.indexOf('022_messaging_safety_governor.sql'),
  );
  assert.ok(
    pkg.scripts.migrate.indexOf('022_messaging_safety_governor.sql')
      < pkg.scripts.migrate.indexOf('023_subscription_catalog_v2.sql'),
  );
});
