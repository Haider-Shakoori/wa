import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
test('ordered production migration files include engines and direct-dispatch upgrade',async()=>{
 const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')&&name!=='012_webhooks.sql').sort();
 const expected=['019_messaging_engine_settings.sql','020_session_engine_handover.sql','021_system_alerts.sql','022_messaging_safety_governor.sql','023_subscription_catalog_v2.sql','026_viewable_session_keys.sql','027_direct_message_dispatch.sql'];
 for(const name of expected)assert.ok(files.includes(name));
 for(let i=1;i<expected.length;i++)assert.ok(files.indexOf(expected[i-1])<files.indexOf(expected[i]));
});
