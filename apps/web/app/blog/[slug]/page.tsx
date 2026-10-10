import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicHeader,PublicFooter } from '../../../components/relay-home';
import { getPublishedArticle,publishedArticles } from '../../../lib/blog-articles';
import { canonicalUrl } from '../../../lib/seo';
import '../blog.css';

type Params={params:Promise<{slug:string}>};

export function generateStaticParams(){return publishedArticles.map(a=>({slug:a.slug}));}

export async function generateMetadata({params}:Params):Promise<Metadata>{
  const {slug}=await params;
  const a=getPublishedArticle(slug);
  if(!a) return {title:'Tutorial not found',robots:{index:false,follow:false}};
  const url=canonicalUrl('/blog/'+a.slug);
  return {
    title:a.title+' | RelayWA Developer Guides',
    description:a.description,
    alternates:{canonical:url},
    openGraph:{title:a.title,description:a.description,url,type:'article',publishedTime:a.publishedAt,modifiedTime:a.verifiedAt},
    twitter:{card:'summary',title:a.title,description:a.description},
  };
}

export default async function Tutorial({params}:Params){
  const {slug}=await params;
  const article=getPublishedArticle(slug);
  if(!article)notFound();
  const url=canonicalUrl('/blog/'+article.slug);
  const schema=[
    {'@type':'TechArticle','@id':url+'#article',headline:article.title,description:article.description,
      url,inLanguage:'en',datePublished:article.publishedAt,dateModified:article.verifiedAt,
      author:{'@type':'Organization',name:'RelayWA Engineering'},
      publisher:{'@type':'Organization',name:'RelayWA',url:canonicalUrl('/')},
      mainEntityOfPage:{'@type':'WebPage','@id':url},isAccessibleForFree:true},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Home',item:canonicalUrl('/')},
      {'@type':'ListItem',position:2,name:'Developer guides',item:canonicalUrl('/blog')},
      {'@type':'ListItem',position:3,name:article.title,item:url},
    ]},
  ];
  const serialized=JSON.stringify({'@context':'https://schema.org','@graph':schema}).replace(/</g,'\\u003c');
  return <main className="rw-site" id="main-content">
    <PublicHeader/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serialized}}/>
    <article className="rw-site-section rw-article">
      <nav aria-label="Breadcrumb" className="rw-article-breadcrumbs"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/blog">Developer guides</Link></nav>
      <p className="rw-kicker">ENGLISH DEVELOPER TUTORIAL · {article.readingMinutes} MIN READ</p>
      <h1>{article.title}</h1>
      <p className="rw-article-lead">{article.description}</p>
      <p className="rw-article-facts">Published <time dateTime={article.publishedAt}>{article.publishedAt}</time> · Last verified <time dateTime={article.verifiedAt}>{article.verifiedAt}</time> · RelayWA Engineering</p>
      <div className="rw-article-warning"><strong>Architecture disclosure:</strong> RelayWA uses QR-linked WhatsApp Web sessions. It is not Meta's official WhatsApp Cloud API or a Meta Business Solution Provider. Do not send unsolicited messages.</div>
      <nav aria-label="On this page" className="rw-article-contents"><strong>In this guide</strong>{article.blocks.map(block=><a href={'#'+block.id} key={block.id}>{block.heading}</a>)}</nav>
      <div className="rw-article-body">
        {article.blocks.map(block=><section key={block.id} id={block.id}>
          <h2>{block.heading}</h2>
          {block.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
          {block.bullets&&<ul>{block.bullets.map((bullet,i)=><li key={i}>{bullet}</li>)}</ul>}
          {block.code&&<pre><code>{block.code}</code></pre>}
        </section>)}
      </div>
      <section className="rw-article-next">
        <h2>Use the tested examples and canonical API reference</h2>
        <p>Browse the complete example source at <a href={'https://github.com/Haider-Shakoori/wa/blob/main/'+article.sourcePath} target="_blank" rel="noopener noreferrer">RelayWA's example source on GitHub</a>. Keep production secrets private. Run the tests before integrating with real customer accounts.</p>
        <p><Link href="/api-docs#quickstart">REST API quickstart</Link> · <Link href="/api-docs#webhooks">Signed webhook specification</Link> · <Link href="/pricing">Compare plans</Link></p>
        <Link href="/blog">← All developer tutorials</Link>
      </section>
    </article>
    <PublicFooter/>
  </main>;
}