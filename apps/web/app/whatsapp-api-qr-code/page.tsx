import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../../components/relay-home';
import { marketingPageMetadata, canonicalUrl } from '../../lib/seo';

export const metadata = marketingPageMetadata('/whatsapp-api-qr-code');

export default function QrCodeApiPage() {
  const url = canonicalUrl('/whatsapp-api-qr-code');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'WhatsApp API with QR Code | Connect Your Number — RelayWA',
    description: 'How to connect a number to a QR-linked WhatsApp Web API.',
    url,
    isPartOf: { '@type': 'WebSite', name: 'RelayWA', url: canonicalUrl('/') },
  };
  return <main className="rw-site" id="main-content">
    <PublicHeader />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g,'\\u003c')}} />
    <section className="rw-site-section rw-developer-topics" aria-labelledby="qr-api-title">
      <div className="rw-section-intro">
        <p className="rw-kicker">QR-LINKED WHATSAPP WEB API</p>
        <h1 id="qr-api-title">Connect a WhatsApp number to a REST API with a QR code</h1>
        <p>RelayWA lets an account owner link an existing WhatsApp number using the Linked devices QR workflow, then communicate through scoped, server-side REST API credentials. This is an <strong>unofficial WhatsApp Web session integration</strong>, not access to Meta&apos;s official WhatsApp Cloud API.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h2>1. Create a session</h2>
          <p>From your authorized RelayWA workspace, create a session for the number you control. A session belongs to your organization and has its own connection state. See the exact session creation API and required permissions in the reference.</p>
          <Link className="rw-topic-more" href="/api-docs#sessions">Session creation and scopes →</Link>
        </article>
        <article>
          <h2>2. Scan the current QR</h2>
          <p>Open WhatsApp on your phone, choose Linked devices and scan the <em>current</em> session QR. Treat QR payloads like credentials; do not publish them in logs, analytics, screenshots or support tickets.</p>
          <Link className="rw-topic-more" href="/blog/whatsapp-api-qr-session-troubleshooting">QR expiry and reconnection →</Link>
        </article>
        <article>
          <h2>3. Verify connection state</h2>
          <p>Check whether the session is <code>connected</code> before attempting a send. A missing or expired QR alone does not prove that an already-connected session is broken. Handle disconnection and re-pairing as ordinary integration states.</p>
          <Link className="rw-topic-more" href="/api-docs#sessions">Read session status →</Link>
        </article>
        <article>
          <h2>4. Use a scoped API key</h2>
          <p>Keep the session API key in your backend, not in public JavaScript. Send opt-in notifications using documented endpoints and a stable client message ID. Transport acceptance does not guarantee delivery, reading or immunity from account restrictions.</p>
          <Link className="rw-topic-more" href="/api-docs#quickstart">REST API quickstart →</Link>
        </article>
      </div>
      <section aria-labelledby="qr-integration-checklist">
        <h2 id="qr-integration-checklist">QR code WhatsApp API integration checklist</h2>
        <p>Before connecting a WhatsApp number to your application, separate pairing, API authorization and message delivery into distinct checks. A successful QR scan does not by itself confirm that your backend is ready to send notifications.</p>
        <div className="rw-developer-topic-grid">
          <article>
            <h3>Pair the right account</h3>
            <p>Confirm the number belongs to your business or an authorized client. Scan only the QR generated for that session, and avoid storing the QR image in analytics or support logs.</p>
            <Link className="rw-topic-more" href="/blog/whatsapp-api-qr-session-troubleshooting">Troubleshoot QR pairing →</Link>
          </article>
          <article>
            <h3>Keep credentials server-side</h3>
            <p>Use the session-scoped API key only from your backend. Review the current request examples and never expose credentials in browser code or publicly shared repositories.</p>
            <Link className="rw-topic-more" href="/api-docs#quickstart">Review the REST API quickstart →</Link>
          </article>
          <article>
            <h3>Process events safely</h3>
            <p>Verify signed webhook callbacks and deduplicate event IDs before changing order or customer records. Treat request acceptance and final message delivery as separate states.</p>
            <Link className="rw-topic-more" href="/whatsapp-webhooks">Read the webhook integration guide →</Link>
          </article>
        </div>
      </section>
      <section aria-labelledby="qr-api-questions">
        <h2 id="qr-api-questions">Common questions about QR-linked WhatsApp APIs</h2>
        <div className="rw-faq">
          <details><summary>Is RelayWA the official Meta WhatsApp API?</summary><p>No. RelayWA uses QR-linked WhatsApp Web sessions. Meta&apos;s official Business Platform is a separate product with a different account setup, authorization model and policies. <Link href="/guides/whatsapp-web-vs-cloud-api">Compare the two approaches</Link>.</p></details>
          <details><summary>What happens when a QR code expires?</summary><p>A QR may expire while the session is waiting for pairing. Check the current session status and request or display an available current QR through the documented workflow. Do not delete or repeatedly reset a working session simply because an earlier QR expired.</p></details>
          <details><summary>Can one organization connect more than one number?</summary><p>RelayWA supports distinct sessions. The number of sessions your workspace may use depends on its actual subscription entitlement and operational limits; review <Link href="/pricing">live pricing and allowances</Link>.</p></details>
          <details><summary>Can I connect without Meta Business Platform approval?</summary><p>This QR-based mechanism is not Meta&apos;s approved Cloud API onboarding. Using unofficial integrations can carry service interruption and account restriction risks, and all use must comply with applicable policies and consent requirements.</p></details>
        </div>
      </section>
      <p className="rw-topic-disclosure">Security and policy note: pair only accounts you own or are authorized to operate; obtain meaningful recipient opt-in and respect opt-outs. No unofficial WhatsApp integration can promise zero bans, unrestricted messaging, or guaranteed delivery.</p>
      <p><Link href="/whatsapp-webhooks">Next: receive signed WhatsApp events →</Link> · <Link href="/api-docs">Complete API documentation</Link></p>
    </section>
    <PublicFooter />
  </main>;
}
