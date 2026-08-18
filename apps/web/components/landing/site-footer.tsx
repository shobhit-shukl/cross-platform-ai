import Link from 'next/link';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Platforms', href: '#platforms' },
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Sign up', href: '/login?mode=register' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                C
              </span>
              <span className="text-base font-semibold tracking-tight text-ink">CrossPost AI</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-faint">
              Publish once, everywhere. Connected through official platform APIs.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <h3 className="text-sm font-semibold text-ink">{column.heading}</h3>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) =>
                    link.href.startsWith('#') ? (
                      <li key={link.label}>
                        <a href={link.href} className="text-sm text-ink-faint transition hover:text-ink">
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-ink-faint transition hover:text-ink"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} CrossPost AI. Not affiliated with YouTube,
            Instagram, LinkedIn, TikTok, Snapchat, X or Facebook.
          </p>
        </div>
      </div>
    </footer>
  );
}
