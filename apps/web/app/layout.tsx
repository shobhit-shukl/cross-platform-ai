import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// next/font self-hosts the files at build time — no render-blocking request to Google,
// no layout shift, and no third-party font request from the user's browser.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

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
    <html lang="en" className={`dark ${jakarta.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
