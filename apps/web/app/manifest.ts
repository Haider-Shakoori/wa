import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'RelayWA', short_name: 'RelayWA', description: 'WhatsApp API for developers', start_url: '/', display: 'standalone', background_color: '#070909', theme_color: '#070909', icons: [{ src: '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' }] };
}
