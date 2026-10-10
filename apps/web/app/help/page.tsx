import Link from 'next/link';
import { PublicHeader, PublicFooter, FAQ } from '../../components/relay-home';
import { marketingPageMetadata } from '../../lib/seo';
import { developerTopics } from '../../lib/seo-topic-map';

export const metadata = marketingPageMetadata('/help');

export default function Page() {
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <section className="rw-site-section">
      <div className="rw-section-intro">
        <p className="rw-kicker">RELAYWA HELP CENTER</p>
        <h1>Answers for your WhatsApp API integration</h1>
        <p>Find help with QR-linked sessions, subscriptions, message status and webhooks. For request examples and exact API endpoints, use our <Link href="/api-docs">developer documentation</Link>.</p>
      </div>
      <FAQ />
    </section>
    <section className="rw-site-section rw-developer-topics" aria-labelledby="help-api-guides-heading">
      <div className="rw-section-intro">
        <h2 id="help-api-guides-heading">Go directly to the relevant API guide</h2>
        <p>Each topic opens the existing English documentation. No separate or duplicated feature pages are needed.</p>
      </div>
      <div className="rw-developer-topic-grid">
        {developerTopics.filter((topic) => ['quickstart', 'sessions', 'webhooks'].includes(topic.id)).map((topic) =>
          <article key={topic.id}>
            <h3><Link href={topic.href}>{topic.title}</Link></h3>
            <p>{topic.summary}</p>
            <Link className="rw-topic-more" href={topic.href}>View API documentation <span aria-hidden="true">→</span></Link>
          </article>
        )}
      </div>
    </section>
    <PublicFooter />
  </main>;
}
