'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/api';

/**
 * The only client component on the landing page. Auth state can't be resolved during
 * SSR — getCurrentUser() is a cross-origin call to the NestJS backend carrying a
 * session cookie — so this hydrates on its own while every other section stays static.
 *
 * Defaults to the signed-out state rather than a loading placeholder, for two reasons:
 * the anonymous visitor is the overwhelming majority on a marketing page and gets a
 * correct CTA with no wait, and the button stays a real <Link> even if JS is slow or
 * disabled. A signed-in visitor briefly sees "Sign up" before it relabels — a same-size
 * text swap in a fixed-width box, so nothing reflows.
 *
 * The state must initialise to the same value the server rendered; reading cookies or
 * `window` during render would cause a hydration mismatch.
 */
export function AuthCta({ variant = 'nav' }: { variant?: 'nav' | 'hero' }) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then(() => !cancelled && setAuthed(true))
      // A rejection means "not signed in" (or the backend is unreachable) — either way
      // the signed-out CTA is the safe thing to show.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Press feedback is plain CSS (transform on :active), not Framer Motion — it's a
  // one-line cost per element and there are dozens of buttons across the app; JS-driven
  // gesture handling is reserved for places that need orchestration Framer Motion
  // actually helps with (stagger, scroll-reveal, exit animations).
  const pressable = 'transition-transform duration-fast ease-spring active:scale-[0.96]';

  if (variant === 'hero') {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href={authed ? '/dashboard' : '/login?mode=register'}
          className={`inline-flex h-12 min-w-[13rem] items-center justify-center rounded-lg bg-brand-gradient px-6 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(139,92,246,0.7)] transition hover:shadow-[0_0_40px_-6px_rgba(139,92,246,0.9)] hover:brightness-110 ${pressable}`}
        >
          {authed ? 'Go to Dashboard' : 'Get started free'}
        </Link>
        <a
          href="#how-it-works"
          className={`inline-flex h-12 items-center justify-center rounded-lg border border-border-strong bg-white/[0.03] px-6 text-sm font-semibold text-ink-soft backdrop-blur transition hover:border-white/30 hover:text-ink ${pressable}`}
        >
          See how it works
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {!authed && (
        <Link
          href="/login"
          className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:text-ink sm:block"
        >
          Log in
        </Link>
      )}
      <Link
        href={authed ? '/dashboard' : '/login?mode=register'}
        className={`inline-flex h-10 min-w-[9.5rem] items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 ${pressable}`}
      >
        {authed ? 'Go to Dashboard' : 'Sign up'}
      </Link>
    </div>
  );
}
