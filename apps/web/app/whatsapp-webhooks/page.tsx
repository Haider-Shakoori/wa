import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../../components/relay-home';
import { marketingPageMetadata, canonicalUrl } from '../../lib/seo';

export const metadata = marketingPageMetadata('/whatsapp-webhooks');

export default function WhatsAppWebhooksPage() {
  const url = canonicalUrl('/whatsapp-webhooks');
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage',
    name: 'WhatsApp API Webhooks | Signed Events & Examples — RelayWA',
    description: 'Webhook event integration and validation for RelayWA QR-linked WhatsApp sessions.',
    url, isPartOf: { '@type': 'WebSite', name: 'RelayWA', url: canonicalUrl('/') } };
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
    <section className="rw-site-section rw-developer-topics" aria-labelledby="webhook-title">
      <div className="rw-section-intro">
        <p className="rw-kicker">INBOUND EVENTS & SIGNED CALLBACKS</p>
        <h1 id="webhook-title">WhatsApp API webhooks for message and session events</h1>
        <p>RelayWA can deliver webhook callbacks for events associated with its QR-linked WhatsApp sessions. Validate each event before updating a customer record, triggering an order workflow or changing the state of your application.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h2>Register a secure HTTPS endpoint</h2>
          <p>Configure a webhook endpoint in your authorized workspace and store its signing secret in server-only configuration. Receive callbacks using a backend route that accepts the exact original request body.</p>
          <Link className="rw-topic-more" href="/api-docs#webhooks">Webhook configuration and event reference →</Link>
        </article>
        <article>
          <h2>Verify the raw-body HMAC signature</h2>
          <p>RelayWA uses an HMAC-SHA256 signature over the timestamp, a period and the raw request body. Compare the digest with <code>x-relaywa-signature</code> using constant-time comparison; reject stale timestamps. Do not parse and reserialize the JSON before hashing it.</p>
          <Link className="rw-topic-more" href="/blog/nodejs-whatsapp-api-send-webhooks">Tested Node.js verification example →</Link>
        </article>
        <article>
          <h2>Deduplicate incoming event IDs</h2>
          <p>Persist the received event ID with a unique database constraint. If an event arrives more than once, acknowledge the duplicate without applying the business operation twice. Queue work only after your database transaction succeeds.</p>
          <Link className="rw-topic-more" href="/blog/laravel-whatsapp-api-order-notifications">Laravel order notification and event handling →</Link>
        </article>
        <article>
          <h2>Handle retries and uncertain outcomes</h2>
          <p>Webhook delivery retries and outbound message retries are different concerns. Your application must handle delivery failures, response timeouts and unknown send outcomes without inventing a new client message ID on every retry. Check the current API reference for supported status and retry behavior.</p>
          <Link className="rw-topic-more" href="/api-docs#queue">Direct sends and application-owned retries →</Link>
        </article>
      </div>
      <section aria-labelledby="webhook-questions">
        <h2 id="webhook-questions">Webhook integration questions</h2>
        <div className="rw-faq">
          <details><summary>How do I know a callback really came from my webhook integration?</summary><p>Use the secret configured for that webhook to validate the timestamped HMAC signature of the exact raw HTTP body. Check timestamp freshness and compare digests in constant time.</p></details>
          <details><summary>Can a webhook be delivered more than once?</summary><p>Design your receiver to be idempotent. Use unique event IDs, persist receipt, and avoid processing the same business operation twice even if a sender or network retries.</p></details>
          <details><summary>Does a successful send API response mean the message was read?</summary><p>No. Request acceptance, dispatch and recipient delivery or reading are distinct states. Consult the message status and documented callback types; none is a guarantee of read receipt.</p></details>
          <details><summary>Does RelayWA send messages on a built-in retry queue?</summary><p>Not in the documented integration release. Outbound scheduling, pacing and retries belong in your application; webhook callback delivery has separate behavior.</p></details>
        </div>
      </section>
      <p className="rw-topic-disclosure">RelayWA uses unofficial QR-linked WhatsApp Web sessions, not Meta&apos;s official Cloud API. Handle consent and opt-outs, avoid unsolicited messaging, and do not assume uninterrupted service or guaranteed delivery.</p>
      <p><Link href="/whatsapp-api-qr-code">Set up a QR-linked session</Link> · <Link href="/api-docs#webhooks">Canonical webhook specification</Link> · <Link href="/guides/whatsapp-web-vs-cloud-api">Compare connection models</Link></p>
    </section>
    <PublicFooter />
  </main>;
}
