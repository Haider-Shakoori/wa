import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../../../components/relay-home';
import { marketingPageMetadata, canonicalUrl } from '../../../lib/seo';

export const metadata = marketingPageMetadata('/guides/whatsapp-web-vs-cloud-api');

export default function WhatsAppIntegrationComparison() {
  const url = canonicalUrl('/guides/whatsapp-web-vs-cloud-api');
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage',
    name: 'WhatsApp Web API vs Official Cloud API | Key Differences',
    description: 'A factual comparison of QR-linked WhatsApp Web API integrations and the official Meta WhatsApp Cloud API.',
    url, isPartOf: { '@type': 'WebSite', name: 'RelayWA', url: canonicalUrl('/') } };
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
    <section className="rw-site-section rw-developer-topics" aria-labelledby="compare-title">
      <div className="rw-section-intro">
        <p className="rw-kicker">UNDERSTAND YOUR INTEGRATION MODEL</p>
        <h1 id="compare-title">WhatsApp Web API vs Meta&apos;s official WhatsApp Cloud API</h1>
        <p>Both approaches can connect business systems to WhatsApp, but they have different authorization, onboarding, account dependencies and operational risks. RelayWA is a <strong>QR-linked WhatsApp Web integration</strong>. It does <strong>not</strong> provide Meta&apos;s official WhatsApp Business Platform API.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h2>QR-linked WhatsApp Web sessions</h2>
          <p>An authorized account owner links an existing WhatsApp number with the Linked devices QR workflow. RelayWA then exposes a session-based REST interface and related webhooks. The connection can require re-pairing and is dependent on changes to the underlying WhatsApp Web service.</p>
          <p>Because this is unofficial, it may be affected by WhatsApp restrictions, connection changes and service interruptions. No vendor can truthfully guarantee ban immunity or unrestricted automated sending.</p>
          <Link className="rw-topic-more" href="/whatsapp-api-qr-code">Read RelayWA QR onboarding →</Link>
        </article>
        <article>
          <h2>Official Meta WhatsApp Cloud API</h2>
          <p>Meta&apos;s WhatsApp Business Platform uses official business assets, account and phone number setup and API authentication through the platform. The official API has its own published pricing, messaging rules, limits and approval or verification requirements where applicable.</p>
          <p>Use the official platform if formal Meta authorization or an official partner integration is a requirement for your organization. A QR-linked product should not be represented as equivalent approval.</p>
          <a className="rw-topic-more" href="https://www.postman.com/meta/whatsapp-business-platform/overview" target="_blank" rel="noopener noreferrer">Meta official API collections ↗</a>
        </article>
      </div>
      <section aria-labelledby="compare-checklist">
        <h2 id="compare-checklist">What should you compare before choosing?</h2>
        <div className="rw-developer-topic-grid">
          <article><h3>Connection and credentials</h3><p>Do you need QR pairing tied to a Linked devices session, or official business platform credentials and managed phone number setup?</p></article>
          <article><h3>Account policy and consent</h3><p>Which usage rules govern your business? Either way, obtain appropriate customer consent and respect opt-outs. For unofficial applications, account restriction and authorization risks deserve special scrutiny.</p></article>
          <article><h3>Reliability expectations</h3><p>What happens when a session disconnects or service behavior changes? Design reconnection and operational monitoring without treating a successful send request as guaranteed recipient delivery.</p></article>
          <article><h3>Cost and team ownership</h3><p>Compare live subscription/session allowances against Meta&apos;s official pricing structure, plus integration time, support needs and your own maintenance responsibilities.</p></article>
        </div>
      </section>
      <section aria-labelledby="compare-faq">
        <h2 id="compare-faq">Common questions about the two API approaches</h2>
        <div className="rw-faq">
          <details><summary>Does RelayWA use Meta Cloud API?</summary><p>No. RelayWA connects WhatsApp accounts using unofficial QR-linked WhatsApp Web sessions and its own REST gateway.</p></details>
          <details><summary>Does a QR connection remove WhatsApp restrictions?</summary><p>No. Account policies and enforcement still matter. Unofficial tools can face restrictions or account interruption; there is no guaranteed safe sending volume.</p></details>
          <details><summary>Which approach is best for regulated business messaging?</summary><p>If your organization requires formally authorized Meta integrations, assess the official WhatsApp Business Platform first. Review requirements with the service provider and your compliance team.</p></details>
        </div>
      </section>
      <p className="rw-topic-disclosure">Sources and further reading: <a href="https://www.postman.com/meta/whatsapp-business-platform/overview" target="_blank" rel="noopener noreferrer">Meta WhatsApp Business Platform documentation</a> · <a href="https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App" target="_blank" rel="noopener noreferrer">WhatsApp Business App terms</a> · <a href="https://whatsappbusiness.com/policy/" target="_blank" rel="noopener noreferrer">WhatsApp Business Messaging Policy</a>. Product capabilities and platform terms may change; consult the live source before deciding.</p>
      <p><Link href="/pricing">Compare RelayWA subscription plans</Link> · <Link href="/whatsapp-webhooks">Webhook integrations</Link> · <Link href="/api-docs">Technical documentation</Link></p>
    </section>
    <PublicFooter />
  </main>;
}
