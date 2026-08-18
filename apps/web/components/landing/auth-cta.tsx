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
export function AuthCta({
  variant = 'nav',
  tone = 'light',
}: {
  variant?: 'nav' | 'hero';
  /** 'dark' inverts the button colours for use on a dark section background. */
  tone?: 'light' | 'dark';
}) {
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

  if (variant === 'hero') {
    const primary =
      tone === 'dark'
        ? 'bg-white text-slate-900 hover:bg-slate-100'
        : 'bg-slate-900 text-white hover:bg-slate-800';
    const secondary =
      tone === 'dark'
        ? 'border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href={authed ? '/dashboard' : '/login?mode=register'}
          className={`inline-flex h-12 min-w-[13rem] items-center justify-center rounded-lg px-6 text-sm font-semibold shadow-sm transition ${primary}`}
        >
          {authed ? 'Go to Dashboard' : 'Get started free'}
        </Link>
        <a
          href="#how-it-works"
          className={`inline-flex h-12 items-center justify-center rounded-lg border px-6 text-sm font-semibold transition ${secondary}`}
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
          className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
        >
          Log in
        </Link>
      )}
      <Link
        href={authed ? '/dashboard' : '/login?mode=register'}
        className="inline-flex h-10 min-w-[9.5rem] items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {authed ? 'Go to Dashboard' : 'Sign up'}
      </Link>
    </div>
  );
}
