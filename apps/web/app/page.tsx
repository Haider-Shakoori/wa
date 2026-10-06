import Link from 'next/link';

export default function Home() {
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="brand-mark large">rW</div>
        <p className="eyebrow" style={{marginTop:24}}>relayWA by BusinessOS</p>
        <h1>WhatsApp infrastructure built for applications.</h1>
        <p>Connect sessions, relay messages from your software, receive events, manage webhooks and scale through one control plane.</p>
      </section>
      <section className="auth-card">
        <p className="eyebrow">Customer dashboard</p>
        <h2>Operate relayWA from one place.</h2>
        <p className="muted">Sessions, QR linking, API credentials, message usage, webhooks and billing are all managed from the relayWA workspace.</p>
        <Link className="primary-button wide" href="/login" style={{display:'block',textAlign:'center',textDecoration:'none'}}>Open dashboard</Link>
      </section>
    </main>
  );
}
