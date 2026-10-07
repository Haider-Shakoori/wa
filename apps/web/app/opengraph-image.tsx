import { ImageResponse } from 'next/og';
export const alt = 'RelayWA — WhatsApp API for developers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0b140e', color: '#f5f7f5' }}><div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginBottom: 48 }}>Relay<span style={{ color: '#25d366' }}>WA</span></div><div style={{ fontSize: 68, fontWeight: 700 }}>WhatsApp API.</div><div style={{ fontSize: 68, fontWeight: 700, color: '#25d366' }}>Built for what you build.</div><div style={{ fontSize: 28, marginTop: 40, color: '#adb5af' }}>REST API · Isolated sessions · Real-time webhooks</div></div>, size);
}
