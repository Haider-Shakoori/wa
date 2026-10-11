import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const file=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');

test('Python and .NET source-backed integration examples are testable and NOT prematurely published',()=>{
  const py=file('examples/relaywa-python-webhooks/relaywa_example.py');
  const pyTest=file('examples/relaywa-python-webhooks/test_relaywa.py');
  const cs=file('examples/relaywa-dotnet-transactional/Program.cs');
  const proj=file('examples/relaywa-dotnet-transactional/RelayWaExample.csproj');
  const workflow=file('.github/workflows/seo-python-dotnet-examples.yml');
  const calendar=file('docs/seo/editorial-calendar.csv');
  const article=file('apps/web/lib/blog-articles.ts');
  const pages=file('apps/web/lib/public-pages.ts');
  for(const [slug,source] of [
    ['python-whatsapp-api-webhook-workflow',py],
    ['dotnet-whatsapp-api-transactional-integration',cs],
  ]){
    assert.match(calendar,new RegExp('"'+slug+'","draft"'));
    assert.ok(source.length>2000);
    assert.ok(!article.includes("slug: '"+slug+"'"),'No unapproved public article');
    assert.ok(!pages.includes('/blog/'+slug),'No unapproved sitemap or GA4 URL');
  }
  assert.match(py,/hmac\.compare_digest/);
  assert.match(py,/clientMessageId/);
  assert.match(pyTest,/test_http_receiver_rejects_bad_signatures/);
  assert.match(pyTest,/test_disconnected_and_network_failures_never_retry/);
  assert.match(cs,/CryptographicOperations\.FixedTimeEquals/);
  assert.match(cs,/RelayWaSendUncertainException/);
  assert.match(cs,/--self-test/);
  assert.match(proj,/<TargetFramework>net8\.0/);
  assert.match(workflow,/python -m unittest discover/);
  assert.match(workflow,/dotnet build /);
  assert.match(workflow,/dotnet run /);
});
