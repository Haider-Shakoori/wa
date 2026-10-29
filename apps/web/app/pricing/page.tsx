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
        <h2 id="pricing-model-heading">WhatsApp API cost: QR-linked plans vs. Meta's official API pricing</h2>
        <p>What does a WhatsApp API cost? For RelayWA, the live plan cards above show the subscription price for QR-linked sessions and the selected billing period. Official Meta WhatsApp Business Platform charges follow a different pricing model. Compare the connection type and included features, not just the headline price.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h3>RelayWA: subscription per connected session</h3>
          <p>RelayWA links an existing WhatsApp account by QR code and uses a session-bound REST API key. The plans above determine your connected-session allowance, monthly or annual billing and total subscription cost. RelayWA does not bill separately for each message; connection reliability and account use remain subject to WhatsApp's platform rules.</p>
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
    <section className="rw-site-section rw-developer-topics" aria-labelledby="pricing-questions-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">BEFORE YOU SUBSCRIBE</p>
        <h2 id="pricing-questions-heading">Understand your RelayWA subscription</h2>
        <p>RelayWA charges for connected WhatsApp numbers through a subscription, not per message. Current plan prices and allowances load from the public plans API. If they cannot load, contact support before purchasing.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h3>What is included in the free trial?</h3>
          <p>New workspaces can test one QR-linked number for seven days with a limit of 50 messages per day. No payment card is needed to begin.</p>
          <Link className="rw-topic-more" href="/register">Start the trial <span aria-hidden="true">→</span></Link>
        </article>
        <article>
          <h3>Are messages billed separately?</h3>
          <p>Paid plans have no per-message RelayWA fee. Your subscription determines connected-session allowances. WhatsApp platform restrictions still apply.</p>
          <Link className="rw-topic-more" href="/api-docs#messages">Review sending behavior <span aria-hidden="true">→</span></Link>
        </article>
        <article>
          <h3>Is RelayWA the official WhatsApp Cloud API?</h3>
          <p>No. RelayWA uses QR-linked WhatsApp Web sessions, not Meta's official Cloud API. Accounts can be restricted or disconnected under WhatsApp's rules.</p>
          <Link className="rw-topic-more" href="/guides/whatsapp-web-vs-cloud-api">Compare integration models <span aria-hidden="true">→</span></Link>
        </article>
      </div>
    </section>
    <section className="rw-site-section rw-developer-topics" aria-labelledby="pricing-guide-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">COMPARE HOW YOUR INTEGRATION WORKS</p>
        <h2 id="pricing-guide-heading">Compare WhatsApp API integration features before choosing a plan</h2>
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
