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
    <section className="rw-site-section rw-developer-topics" aria-labelledby="api-options-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">CHOOSE YOUR WHATSAPP API CONNECTION</p>
        <h2 id="api-options-heading">Meta Cloud API versus QR-linked WhatsApp sessions</h2>
        <p>These are different approaches, not interchangeable products. RelayWA is an independent QR-linked WhatsApp Web session service and is not authorized or certified as Meta's official Cloud API.</p>
      </div>
      <div className="rw-developer-topic-grid">
        <article>
          <h3>Official Meta WhatsApp Cloud API</h3>
          <p>Meta hosts the official WhatsApp Business Platform Cloud API. Its Graph API uses business assets, registered phone numbers and platform access tokens rather than pairing a WhatsApp Web session by scanning a QR code. Choose the official platform when an authorized integration is required.</p>
          <a className="rw-topic-more" href="https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api" target="_blank" rel="noopener noreferrer">Meta's Cloud API reference <span aria-hidden="true">↗</span></a>
        </article>
        <article>
          <h3>RelayWA QR-linked session API</h3>
          <p>RelayWA links an existing WhatsApp number with a QR code and exposes REST methods, session state and signed webhooks. Session connectivity can change, and WhatsApp warns that linking through unofficial apps or websites can create security and account restriction risks. RelayWA cannot promise immunity from restrictions or guaranteed message delivery.</p>
          <a className="rw-topic-more" href="https://faq.whatsapp.com/378279804439436/" target="_blank" rel="noopener noreferrer">WhatsApp's linked-device safety guidance <span aria-hidden="true">↗</span></a>
        </article>
      </div>
      <p className="rw-topic-disclosure">For the current session-based send and retry contract, see <Link href="/api-docs#queue">message dispatch documentation</Link>. For pricing differences, see <Link href="/pricing">the pricing explanation</Link>.</p>
    </section>
    <section className="rw-site-section rw-developer-topics" aria-labelledby="messaging-consent-heading">
      <div className="rw-section-intro">
        <p className="rw-kicker">RESPONSIBLE MESSAGING</p>
        <h2 id="messaging-consent-heading">Only message people who agreed to hear from you</h2>
        <p>Before sending, obtain appropriate opt-in, record what each recipient agreed to receive, and respect opt-out or block requests. Use secure server-side credentials, protect QR codes and verify signed webhooks before handling events. A successful API response does not confirm that a person read your message.</p>
        <p>Read the <a href="https://whatsappbusiness.com/policy/" target="_blank" rel="noopener noreferrer">WhatsApp Business Messaging Policy</a> and the <Link href="/blog/whatsapp-api-qr-session-troubleshooting">QR and session troubleshooting guide</Link>. RelayWA is not affiliated with or endorsed by Meta or WhatsApp.</p>
      </div>
    </section>
    <PublicFooter />
  </main>;
}
