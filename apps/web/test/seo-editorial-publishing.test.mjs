import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseCsv } from '../../../scripts/seo-keyword-research-audit.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const repoRead=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
function load(file){
  const code=ts.transpileModule(read(file),{
    fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports={};
  runInNewContext(code,{exports},{filename:file});
  return exports;
}
const {publishedArticles}=load('lib/blog-articles.ts');
const {publicPages,editorialPages,allPublishedPages,isIndexablePublicPath}=load('lib/public-pages.ts');
const [columns,...csv]=parseCsv(repoRead('docs/seo/editorial-calendar.csv'));
const expected=[
  'slug','status','primary_keyword','locale','author_attribution','editorial_reviewer',
  'review_status','last_source_checked','internal_link_target','source_example','release_gate',
];
const items=csv.map(row=>Object.fromEntries(expected.map((key,i)=>[key,row[i]])));

test('editorial calendar has complete schema, 3 live source-backed tutorials and four gated drafts',()=>{
  assert.deepEqual(columns,expected);
  assert.equal(csv.length,7);
  assert.ok(csv.every(row=>row.length===expected.length));
  const published=items.filter(x=>x.status==='published');
  const drafts=items.filter(x=>x.status==='draft');
  assert.equal(published.length,3);
  assert.equal(drafts.length,4);
  assert.equal(new Set(items.map(x=>x.slug)).size,items.length);
  assert.deepEqual(published.map(x=>x.slug),Array.from(publishedArticles,a=>a.slug));
  assert.equal(editorialPages.length,4); // 1 blog index and exactly 3 live articles
  assert.equal(allPublishedPages.length,publicPages.length+editorialPages.length);
  for(const row of items) {
    assert.equal(row.locale,'en');
    assert.match(row.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(row.primary_keyword,/whatsapp api/);
    assert.ok(row.review_status.length>9);
    assert.ok(row.release_gate.length>15);
    assert.ok(row.internal_link_target.startsWith('/api-docs#')||row.internal_link_target==='/pricing');
  }
  for(const row of published) {
    assert.equal(row.author_attribution,'RelayWA Engineering');
    assert.equal(row.editorial_reviewer,'not recorded','Never invent a human review signoff');
    assert.match(row.last_source_checked,/^\d{4}-\d{2}-\d{2}$/);
    const article=publishedArticles.find(x=>x.slug===row.slug);
    assert.ok(article);
    assert.equal(row.primary_keyword,article.keyword);
    assert.equal(article.verifiedAt,row.last_source_checked);
    assert.equal(row.source_example,article.sourcePath);
    assert.ok(repoRead(row.source_example).length>700);
    assert.equal(isIndexablePublicPath('/blog/'+row.slug),true);
    assert.equal(editorialPages.some(page=>page.path==='/blog/'+row.slug),true);
    assert.match(row.review_status,/(test|source)/i);
  }
  for(const row of drafts){
    assert.equal(row.editorial_reviewer,'unassigned');
    assert.equal(row.source_example,'');
    assert.equal(row.last_source_checked,'');
    assert.equal(isIndexablePublicPath('/blog/'+row.slug),false);
    assert.equal(publishedArticles.some(a=>a.slug===row.slug),false);
  }
});

test('article content, publication dates and internal documentation are not fabricated',()=>{
  const guide=read('app/blog/[slug]/page.tsx');
  assert.match(guide,/getPublishedArticle/);
  assert.match(guide,/generateStaticParams/);
  assert.match(guide,/notFound\(\)/);
  assert.match(guide,/TechArticle/);
  assert.match(guide,/BreadcrumbList/);
  assert.match(guide,/datePublished/);
  assert.match(guide,/dateModified/);
  assert.match(guide,/rel="noopener noreferrer"/);
  for(const article of publishedArticles) {
    assert.equal(article.blocks.length>=4,true);
    assert.ok(article.description.length>90);
    assert.ok(article.blocks.every(x=>x.paragraphs.every(p=>p.length>55)));
    const anchors=article.blocks.map(x=>x.id);
    assert.equal(new Set(anchors).size,anchors.length);
    assert.ok(anchors.every(x=>/^[a-z0-9-]+$/.test(x)));
    assert.ok(Date.parse(article.publishedAt)<=Date.parse(article.verifiedAt));
    assert.match(article.sourcePath,/^examples\/relaywa-/);
    assert.ok(repoRead(article.sourcePath).length>700);
    assert.ok(article.blocks.some(b=>(b.paragraphs.join(' ')+' '+(b.bullets||[]).join(' ')).includes('not Meta') ||
      (b.paragraphs.join(' ')+' '+(b.bullets||[]).join(' ')).includes('different from Meta’s')));
  }
});
