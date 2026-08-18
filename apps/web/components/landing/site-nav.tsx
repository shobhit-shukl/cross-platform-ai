import Link from 'next/link';
import { AuthCta } from './auth-cta';

const NAV_LINKS = [
  { href: '#platforms', label: 'Platforms' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-canvas/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)] transition group-hover:shadow-[0_0_28px_-4px_rgba(139,92,246,0.9)]">
            C
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">CrossPost AI</span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-ink-soft transition hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <AuthCta />
      </nav>
    </header>
  );
}
