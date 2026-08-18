import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CrossPost AI — Publish once, everywhere',
    template: '%s · CrossPost AI',
  },
  description:
    'Connect your social accounts through their official APIs and publish one video across every platform, with AI-written titles, descriptions and captions.',
  openGraph: {
    title: 'CrossPost AI — Publish once, everywhere',
    description:
      'Connect your social accounts through their official APIs and publish one video across every platform.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
