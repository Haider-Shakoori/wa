import Link from 'next/link';
import { PublicHeader, PublicFooter, PricingSection } from '../../components/relay-home';
import { developerTopics } from '../../lib/seo-topic-map';
import { marketingPageMetadata } from '../../lib/seo';

export const metadata = marketingPageMetadata('/pricing');

const pricingGuideTopics = developerTopics.filter((topic) =>
  ['sessions', 'webhooks', 'queue'].includes(topic.id)
);

export default function Page() {
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <PricingSection standalone />
    <section className="rw-site-section rw-developer-topics" aria-labelledby="pricing-guide-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">COMPARE HOW YOUR INTEGRATION WORKS</p>
        <h2 id="pricing-guide-heading">What should you know before choosing a plan?</h2>
        <p>Review how WhatsApp sessions, webhook callbacks and direct message sending work. Your subscription controls connected numbers; sending schedules and automatic outbound retries are managed by your own application.</p>
      </div>
      <div className="rw-developer-topic-grid">
        {pricingGuideTopics.map((topic) => <article key={topic.id}>
          <h3><Link href={topic.href}>{topic.title}</Link></h3>
          <p>{topic.summary}</p>
          <Link className="rw-topic-more" href={topic.href}>Read the API guide <span aria-hidden="true">→</span></Link>
        </article>)}
      </div>
      <p className="rw-topic-disclosure">RelayWA uses QR-linked WhatsApp Web sessions; it is not the official Meta WhatsApp Cloud API.</p>
    </section>
    <PublicFooter />
  </main>;
}
