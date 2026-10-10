import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
function loadTypeScript(path, environment={}) {
  const output=ts.transpileModule(read(path), {
    fileName:path,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports={};
  runInNewContext(output,{exports,process:{env:environment},URL,console},{filename:path});
  return exports;
}

test('framework guides remain within the existing canonical English API docs route',()=>{
  const {integrationGuides,integrationGuideHref}=loadTypeScript('lib/integration-guides.ts');
  const ids=Array.from(integrationGuides,guide=>guide.id);
  assert.deepEqual(ids,['integration-nodejs','integration-laravel','integration-python','integration-dotnet','integration-n8n']);
  for(const guide of integrationGuides){
    assert.equal(integrationGuideHref(guide.id),'/api-docs#'+guide.id);
    assert.ok(guide.summary.length>55);
    assert.ok(guide.requirements.length>70);
    assert.ok(guide.webhook.length>60);
  }
  assert.throws(()=>integrationGuideHref('integration-unknown'),/Unknown integration guide/);
  assert.match(integrationGuides.find(x=>x.id==='integration-n8n').summary,/not an official packaged n8n connector/);
  const source=read('app/docs/page.tsx');
  assert.match(source,/integrationGuides\.map/);
  assert.match(source,/id=\{guide\.id\}/);
  assert.match(source,/integrationExamples\[guide\.codeKey\]/);
  assert.match(source,/id="language-examples"/);
  assert.match(source,/not Meta's official WhatsApp Cloud API/);
  assert.match(read('app/api-docs/page.tsx'),/marketingPageMetadata\('\/api-docs'\)/);
  assert.doesNotMatch(read('lib/public-pages.ts'),/\/integrations\//);
});

test('public integration examples use a complete canonical HTTPS API endpoint',()=>{
  const {integrationExamples,exampleApiBase}=loadTypeScript('lib/integration-examples.ts');
  assert.equal(exampleApiBase,'https://relaywa.com/api');
  const actual=Object.keys(integrationExamples);
  for(const name of ['JavaScript','TypeScript','Python','PHP','Laravel','C#','Java','cURL','Ruby','Go','Swift','PowerShell','Rust','n8n']){
    assert.ok(actual.includes(name),name);
    const snippet=integrationExamples[name];
    assert.match(snippet,/send-message/,name+' route');
    assert.match(snippet,/12025550123/,name+' recipient');
    assert.ok(/Bearer|withToken|bearer_auth|Header Auth/.test(snippet),name+' auth');
    assert.ok(snippet.length>75,name+' content');
    assert.doesNotMatch(snippet,/sk_live_|rk_live_|pk_live_|rw_session_[a-zA-Z0-9]{40,}/,name+' no real secrets');
  }
  assert.match(integrationExamples.Python,/https:\/\/relaywa\.com\/api\/send-message/);
  assert.match(integrationExamples.PHP,/https:\/\/relaywa\.com\/api\/send-message/);
  assert.match(integrationExamples.cURL,/https:\/\/relaywa\.com\/api\/send-message/);
  assert.match(integrationExamples.Python,/raise_for_status\(\)/);
  assert.match(integrationExamples.PHP,/getBody\(\)/);
  assert.doesNotMatch(integrationExamples.PHP,/\$response->throw\(\)/);
  assert.ok(!integrationExamples.JavaScript.includes('process.env.RELAYWA_ACCESS_TOKEN'));
});

test('JavaScript example can send a well-formed JSON request against a mocked REST fixture',async()=>{
  const {integrationExamples}=loadTypeScript('lib/integration-examples.ts');
  const seen=[];
  const mockedFetch=async(url,opts)=>{
    seen.push({url,opts});
    return {ok:true,status:200,json:async()=>({id:'test-message'})};
  };
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const execute=new AsyncFunction('fetch',integrationExamples.JavaScript+'\nreturn result;');
  const message=await execute(mockedFetch);
  assert.equal(message.id,'test-message');
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,'https://relaywa.com/api/send-message');
  assert.equal(seen[0].opts.method,'POST');
  assert.equal(seen[0].opts.headers.Authorization,'Bearer YOUR_SESSION_KEY');
  assert.deepEqual(JSON.parse(seen[0].opts.body),{to:'12025550123',text:'Your order is on its way.'});
  const failure=new AsyncFunction('fetch',integrationExamples.JavaScript);
  await assert.rejects(()=>failure(async()=>({ok:false,status:401})),/HTTP 401/);
});

test('sample API base uses reviewed public site origin, never an internal service hostname',()=>{
  const examples=loadTypeScript('lib/integration-examples.ts',{NEXT_PUBLIC_SITE_URL:'https://docs.example.org/custom/path'});
  assert.equal(examples.exampleApiBase,'https://docs.example.org/api');
  assert.match(examples.integrationExamples.cURL,/docs\.example\.org\/api\/send-message/);
  const api=read('lib/api.ts');
  assert.match(api,/export const API_BASE/);
  assert.match(api,/expireBrowserSession/);
  const source=read('app/docs/page.tsx');
  assert.match(source,/const endpoint = exampleApiBase \+ '\/send-message'/);
  assert.match(source,/\{exampleApiBase\}/);
  assert.doesNotMatch(source,/import \{ API_BASE \} from/);
});

test('existing homepage platform cards lead to anchored docs, not thin integration landing pages',()=>{
  const marketing=read('components/marketing-sections.tsx');
  for(const id of ['nodejs','laravel','python','n8n']){
    assert.ok(marketing.includes('/api-docs#integration-'+id),'missing platform deep link '+id);
  }
  const code=read('components/code-showcase.tsx');
  assert.match(code,/href="\/api-docs#quickstart"/);
  assert.match(code,/TypeScript:'send-message\.ts'/);
  assert.match(code,/n8n:'HTTP Request node'/);
  assert.doesNotMatch(marketing,/href="\/integrations\//);
  assert.match(read('app/layout.tsx'),/<html lang="en"/);
  assert.match(read('components/google-analytics.tsx'),/isIndexablePublicPath/);
});

test('HTML performance smoke verifies all framework deep links and 404s for unpublished topics',()=>{
  const smoke=readFileSync(new URL('../../../scripts/seo-perf-budget.mjs',import.meta.url),'utf8');
  assert.match(smoke,/integration-nodejs/);
  assert.match(smoke,/integration-laravel/);
  assert.match(smoke,/integration-python/);
  assert.match(smoke,/integration-dotnet/);
  assert.match(smoke,/integration-n8n/);
  assert.match(smoke,/\/integrations\/laravel/);
  assert.match(smoke,/\/integrations\/python/);
  assert.match(smoke,/maxJavascriptGzipBytes/);
});
