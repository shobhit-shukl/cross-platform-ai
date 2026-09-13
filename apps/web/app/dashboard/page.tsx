'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConnectedAccounts } from '@/components/connected-accounts';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { ConnectedAccountsSkeleton } from '@/components/ui/skeletons';
import { getCurrentUser, listSocialAccounts, logout } from '@/lib/api';
import { fadeUp } from '@/lib/motion';
import type { CurrentUser, SocialAccount } from '@/lib/types';

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  google_drive: 'Google Drive',
  google_calendar: 'Google Calendar',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

function connectionErrorMessage(reason: string, platformLabel: string): string {
  const messages: Record<string, string> = {
    access_denied: `You declined the permission request, so ${platformLabel} was not connected.`,
    invalid_callback: "The provider's response was missing required information. Please try again.",
    invalid_state: 'This connection request expired or could not be verified. Please try again.',
    exchange_failed: `We could not complete the connection with ${platformLabel}. Please try again.`,
    insufficient_scope: `Required permissions were not granted. Please accept all requested permissions to connect ${platformLabel}.`,
    no_channel: 'That Google account has no YouTube channel to connect.',
    fetch_channel_failed: 'We connected to Google but could not retrieve your channel. Please try again.',
    no_page: 'That Facebook account has no Page you administer. Create a Facebook Page first, then reconnect.',
    no_instagram_account:
      'That account has no professional (Business/Creator) Instagram account to connect. Switch to a professional account in the Instagram app, then reconnect.',
    not_configured: `${platformLabel} isn't set up yet on this server — an admin needs to add its API credentials first.`,
    unknown_error: `Something went wrong while connecting ${platformLabel}. Please try again.`,
  };
  return messages[reason] ?? messages.unknown_error;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
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

    const platformParam = searchParams.get('platform') ?? 'youtube';
    const platformLabel = PLATFORM_LABELS[platformParam] ?? 'the account';

    if (connection === 'success') {
      setBanner({ type: 'success', text: `${platformLabel} connected successfully.` });
    } else if (connection === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown_error';
      setBanner({ type: 'error', text: connectionErrorMessage(reason, platformLabel) });
    }

    // Strip the query params so refreshing the page doesn't re-show the banner.
    router.replace('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user || !accounts) {
    return null;
  }

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10">
      <AnimatedBackground intensity="low" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/videos" className="text-sm font-medium text-ink-soft transition hover:text-ink">
            Your Videos
          </Link>
          <Link href="/drive" className="text-sm font-medium text-ink-soft transition hover:text-ink">
            Google Drive
          </Link>
          <Link href="/calendar" className="text-sm font-medium text-ink-soft transition hover:text-ink">
            Google Calendar
          </Link>
          <Link href="/linkedin" className="text-sm font-medium text-ink-soft transition hover:text-ink">
            LinkedIn
          </Link>
          <Link
            href="/create"
            className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
          >
            Create Post
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="text-sm text-ink-faint transition hover:text-ink-soft"
          >
            Sign out
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className={`overflow-hidden rounded-md px-4 py-3 text-sm ${
              banner.type === 'success'
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border border-rose-500/20 bg-rose-500/10 text-rose-300'
            }`}
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <ConnectedAccounts initialAccounts={accounts} />
      </motion.div>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10">
      <AnimatedBackground intensity="low" />
      <ConnectedAccountsSkeleton />
    </main>
  );
}
