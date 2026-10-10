import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader, PublicFooter } from '../components/relay-home';

export const metadata: Metadata = {
  title: 'Page Not Found | RelayWA',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="rw-site">
      <PublicHeader />
      <section className="rw-site-section" style={{ minHeight: '55vh', textAlign: 'center' }}>
        <div className="rw-section-intro">
          <p className="rw-kicker">404 · PAGE NOT FOUND</p>
          <h1>We couldn&apos;t find that page.</h1>
          <p>The link might be outdated. Visit our <Link href="/">homepage</Link>, check <Link href="/pricing">pricing</Link> or explore the <Link href="/api-docs">API documentation</Link>.</p>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
