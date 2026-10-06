import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'relayWA — WhatsApp Messaging Infrastructure',
  description: 'Connect WhatsApp sessions, send through APIs, monitor webhooks and manage usage with relayWA by BusinessOS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
