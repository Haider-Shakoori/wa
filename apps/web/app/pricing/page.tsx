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
    <section className="rw-site-section rw-developer-topics" aria-labelledby="pricing-faq-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">PRICING QUESTIONS</p>
        <h2 id="pricing-faq-heading">Frequently asked questions about WhatsApp API pricing</h2>
        <p>Check the current subscription cards above for actual RelayWA prices and allowances. The questions below explain what those prices cover and how this integration differs from Meta&apos;s official platform.</p>
      </div>
      <div className="rw-faq">
        <details><summary>How much does the RelayWA WhatsApp API cost?</summary><p>The live pricing cards above show current monthly and annual subscription options. Choose based on the number of connected sessions you need, and confirm the displayed checkout total before subscribing. <Link href="/api-docs#sessions">See how sessions work</Link>.</p></details>
        <details><summary>Is RelayWA the same as the WhatsApp Cloud API?</summary><p>No. RelayWA connects an authorized WhatsApp number through a QR-linked WhatsApp Web session. Meta&apos;s official Cloud API has a separate onboarding process, pricing structure and usage policies. <Link href="/guides/whatsapp-web-vs-cloud-api">Compare the two integration models</Link>.</p></details>
        <details><summary>Does RelayWA charge per WhatsApp message?</summary><p>RelayWA&apos;s subscription is based on plan allowances rather than a separate per-message charge. WhatsApp account restrictions, session availability and responsible messaging limits still apply. <Link href="/api-docs#messages">Read the messaging API documentation</Link>.</p></details>
        <details><summary>Can I integrate RelayWA with Node.js or Laravel?</summary><p>Yes. RelayWA provides HTTP REST endpoints for server-side integrations. Start with the <Link href="/blog/nodejs-whatsapp-api-send-webhooks">Node.js messaging and webhook guide</Link> or the <Link href="/blog/laravel-whatsapp-api-order-notifications">Laravel order notification guide</Link>.</p></details>
        <details><summary>Are delivery and account availability guaranteed?</summary><p>No. A successful API response does not guarantee recipient delivery, and QR-linked unofficial sessions may disconnect or face account restrictions. Implement status checks, consent handling and application-owned retries. <Link href="/whatsapp-webhooks">Learn about webhook events</Link>.</p></details>
      </div>
    </section>
    <PublicFooter />
  </main>;
}
