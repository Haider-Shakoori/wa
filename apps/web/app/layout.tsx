import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BusinessOS WA',
  description: 'Self-hosted WhatsApp session and messaging gateway',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
