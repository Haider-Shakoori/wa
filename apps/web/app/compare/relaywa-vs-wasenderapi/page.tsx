import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../../../components/relay-home';
import { marketingPageMetadata, canonicalUrl } from '../../../lib/seo';

export const metadata = marketingPageMetadata('/compare/relaywa-vs-wasenderapi');

export default function RelayWAVsWasenderAPI() {
  const url = canonicalUrl('/compare/relaywa-vs-wasenderapi');
  const schema = {
    '@context': 'https://schema.org', '@type': 'WebPage',
    name: 'RelayWA vs WasenderAPI: WhatsApp API Comparison',
    url,
    description: 'Compare QR connection, subscription pricing, webhooks, SDK documentation and message handling without assuming feature parity.',
    isPartOf: { '@type': 'WebSite', name: 'RelayWA', url: canonicalUrl('/') },
  };
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    <section className="rw-site-section rw-developer-topics" aria-labelledby="vendor-compare-title">
      <div className="rw-section-intro">
        <p className="rw-kicker">WHATSAPP API COMPARISON</p>
        <h1 id="vendor-compare-title">RelayWA vs WasenderAPI: pricing, QR sessions and developer features</h1>
        <p>RelayWA and WasenderAPI offer QR-linked WhatsApp integrations. These are unofficial integrations, not Meta&apos;s official WhatsApp Cloud API. Compare the actual plans and documented behavior before selecting a provider.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h2>Pricing and message fees</h2>
          <p>RelayWA charges by subscription for connected sessions and does not add a separate per-message RelayWA fee. Prices and session allowances can change; use the live pricing page for the current amount rather than a cached comparison.</p>
          <p>WasenderAPI publishes its own pricing and allowances. Check its current official plan details before comparing monthly costs, message limits or included sessions.</p>
          <Link className="rw-topic-more" href="/pricing">View current RelayWA plans →</Link>
          <p><a className="rw-topic-more" href="https://wasenderapi.com/pricing" target="_blank" rel="noopener noreferrer">Check WasenderAPI pricing ↗</a></p>
        </article>
        <article>
          <h2>Connection and onboarding</h2>
          <p>RelayWA connects an existing WhatsApp account through QR-linked sessions and provides session-bound REST credentials. QR-linked connections depend on WhatsApp Web and may disconnect or require re-pairing.</p>
          <Link className="rw-topic-more" href="/whatsapp-api-qr-code">RelayWA QR setup →</Link>
        </article>
        <article>
          <h2>Queueing, throttling and retries</h2>
          <p>RelayWA documents direct sending. Integrators should implement scheduling, pacing and automatic outbound retries in their own applications; do not assume a managed outbound queue is included. Compare any vendor&apos;s stated rate limits and queue guarantees in its current documentation.</p>
          <Link className="rw-topic-more" href="/api-docs#queue">RelayWA sending behavior →</Link>
        </article>
        <article>
          <h2>Webhooks and SDKs</h2>
          <p>RelayWA supports signed webhook events and publishes integration examples for Node.js, Laravel, Python and .NET. Verify each SDK package and its current supported methods before deployment; examples are not a guarantee of identical SDK feature coverage.</p>
          <Link className="rw-topic-more" href="/api-docs#webhooks">Webhook documentation →</Link>
          <p><Link className="rw-topic-more" href="/api-docs">SDK and API examples →</Link></p>
        </article>
      </div>
      <p className="rw-topic-disclosure">Neither QR-linked service is the official Meta Cloud API. Automated messaging may be subject to account restrictions. This page does not claim independent testing of WasenderAPI or guarantee delivery, ban immunity or unrestricted sending.</p>
    </section>
    <PublicFooter />
  </main>;
}
