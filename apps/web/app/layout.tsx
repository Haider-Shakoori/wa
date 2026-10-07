import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RelayWA — WhatsApp API Infrastructure',
  description: 'Connect WhatsApp sessions, send through APIs, receive webhooks and manage messaging infrastructure with RelayWA.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
