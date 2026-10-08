import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import 'react-phone-number-input/style.css';
import './globals.css';
import './relay.css';
import './branding.css';
import './marketing.css';
import './code-showcase.css';
import './workspace-compact.css';
import NavigationProgress from '../components/navigation-progress';
import GoogleAnalytics from '../components/google-analytics';
import SessionExpiryWatcher from '../components/session-expiry-watcher';
import { siteUrl, siteDescription } from '../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'RelayWA — WhatsApp API for Developers', template: '%s | RelayWA' },
  description: siteDescription,
  applicationName: 'RelayWA',
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: { icon: [{ url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/brand/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#070909', colorScheme: 'dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ backgroundColor: '#070909', colorScheme: 'dark' }}>
      <body className="relay-dark"><NavigationProgress/><SessionExpiryWatcher/><GoogleAnalytics/>{children}</body>
    </html>
  );
}
