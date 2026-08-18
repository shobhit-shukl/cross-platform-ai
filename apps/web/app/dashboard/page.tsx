'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectedAccounts } from '@/components/connected-accounts';
import { getCurrentUser, listSocialAccounts, logout } from '@/lib/api';
import type { CurrentUser, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You declined the Google permission request, so the YouTube account was not connected.',
  invalid_callback: "Google's response was missing required information. Please try again.",
  invalid_state: 'This connection request expired or could not be verified. Please try again.',
  exchange_failed: 'We could not complete the connection with Google. Please try again.',
  insufficient_scope: 'YouTube access was not granted. Please accept all requested permissions to connect.',
  no_channel: 'That Google account has no YouTube channel to connect.',
  fetch_channel_failed: 'We connected to Google but could not retrieve your channel. Please try again.',
  unknown_error: 'Something went wrong while connecting YouTube. Please try again.',
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { user } = await getCurrentUser();
        if (cancelled) return;
        setUser(user);

        const { accounts } = await listSocialAccounts();
        if (cancelled) return;
        setAccounts(accounts);
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const connection = searchParams.get('connection');
    if (!connection) return;

    if (connection === 'success') {
      setBanner({ type: 'success', text: 'YouTube account connected successfully.' });
    } else if (connection === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown_error';
      setBanner({ type: 'error', text: ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.unknown_error });
    }

    // Strip the query params so refreshing the page doesn't re-show the banner.
    router.replace('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (!user || !accounts) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/videos"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Your Videos
          </Link>
          <Link
            href="/create"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create Post
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`mb-6 rounded-md px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      <ConnectedAccounts initialAccounts={accounts} />
    </main>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{children}</div>
  );
}
