import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../../components/relay-home';
import { publishedArticles } from '../../lib/blog-articles';
import { canonicalUrl } from '../../lib/seo';
import type { Metadata } from 'next';
import './blog.css';

export const metadata:Metadata={
  title:'RelayWA Developer Guides — WhatsApp REST API Tutorials',
  description:'Original English tutorials for QR-linked WhatsApp API integrations: Node.js webhooks, Laravel notifications, security and safe sending practices.',
  alternates:{canonical:canonicalUrl('/blog')},
  openGraph:{title:'RelayWA Developer Guides',description:'Practical WhatsApp API tutorials for developers using QR-linked sessions.',url:canonicalUrl('/blog'),type:'website'},
};

export default function BlogIndex(){
  return <main className="rw-site" id="main-content">
    <PublicHeader/>
    <section className="rw-site-section rw-article-index" aria-labelledby="blog-title">
      <div className="rw-section-intro">
        <p className="rw-kicker">DEVELOPER GUIDES</p>
        <h1 id="blog-title">WhatsApp API tutorials for developers</h1>
        <p>Implement real integration workflows using RelayWA's QR-linked WhatsApp Web sessions. This is not Meta's official Cloud API. The API endpoint reference remains in <Link href="/api-docs">documentation</Link>.</p>
      </div>
      <div className="rw-developer-topic-grid">
        {publishedArticles.map(article=><article key={article.slug}>
          <p className="rw-kicker">{article.readingMinutes} min read · Verified {article.verifiedAt}</p>
          <h2><Link href={'/blog/'+article.slug}>{article.title}</Link></h2>
          <p>{article.summary}</p>
          <Link className="rw-topic-more" href={'/blog/'+article.slug}>Read tutorial <span aria-hidden="true">→</span></Link>
        </article>)}
      </div>
      <p>For accurate current request fields and webhook headers, use <Link href="/api-docs">the API reference</Link>. Follow WhatsApp account policies and message only opted-in recipients.</p>
    </section>
    <PublicFooter/>
  </main>;
}