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
    <section className="rw-site-section rw-developer-topics" aria-labelledby="pricing-model-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">WHATSAPP API PRICING EXPLAINED</p>
        <h2 id="pricing-model-heading">QR-linked API subscription vs. Meta's official API pricing</h2>
        <p>These are different connection models with different pricing. Before comparing quotes from WhatsApp API providers, confirm whether a plan is for an unofficial WhatsApp Web-linked session or Meta's official WhatsApp Business Platform.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h3>RelayWA: subscription per connected session</h3>
          <p>RelayWA links an existing WhatsApp account by QR code and uses a session-bound REST API key. The plans above determine your available connected sessions. RelayWA does not bill separately for each message; connection reliability and account use remain subject to WhatsApp's platform rules.</p>
          <Link className="rw-topic-more" href="/api-docs#sessions">Review QR-session setup <span aria-hidden="true">→</span></Link>
        </article>
        <article>
          <h3>Official WhatsApp Business Platform: Meta-managed API</h3>
          <p>Meta's official Cloud API is a different product. Its published rates vary by message category and destination market, and your chosen solution provider may charge separately. RelayWA does not supply official Cloud API access or Meta Business Solution Provider services.</p>
          <a className="rw-topic-more" href="https://whatsappbusiness.com/products/platform-pricing/" target="_blank" rel="noopener noreferrer">Read Meta's official pricing <span aria-hidden="true">↗</span></a>
        </article>
      </div>
      <p className="rw-topic-disclosure">Choose Meta's official platform if your workflow requires official authorization. For RelayWA, review the live plan cards, the trial conditions, and <Link href="/api-docs#queue">how sending and retries work</Link> before subscribing.</p>
    </section>
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
