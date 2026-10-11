import Image from 'next/image';

export default function Loading() {
  // This is a route-transition fallback, not the homepage LCP image.
  // Avoid preloading a full-size PNG on every public page request.
  return <main className="rw-route-loading" aria-busy="true">
    <Image src="/brand/relaywa-icon-web.png" width={64} height={32}
      sizes="64px" loading="lazy" alt="RelayWA" />
    <p>Loading your next connection…</p>
  </main>;
}
