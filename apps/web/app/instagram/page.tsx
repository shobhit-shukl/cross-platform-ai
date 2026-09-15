'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstagramAccountCard } from '@/components/instagram-account-card';
import { InstagramPublishForm } from '@/components/instagram-publish-form';
import { InstagramMediaList } from '@/components/instagram-media-list';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { InstagramMediaSkeleton, ProfileCardSkeleton } from '@/components/ui/skeletons';
import { ApiError, getCurrentUser, listInstagramMedia, listSocialAccounts } from '@/lib/api';
import { fadeUp, smooth } from '@/lib/motion';
import type { InstagramMedia, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  quota_exceeded: 'Instagram rate limit reached. Please try again shortly.',
  network_error: 'A network error occurred while contacting Instagram. Please try again.',
};

export default function InstagramPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [instagramAccount, setInstagramAccount] = useState<SocialAccount | null>(null);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setError(null);
    setMediaLoading(true);
    try {
      const { items } = await listInstagramMedia();
      setMedia(items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading Instagram media.');
      }
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await getCurrentUser();
        const { accounts } = await listSocialAccounts();
        if (cancelled) return;
        const account = accounts.find((a) => a.platform === 'INSTAGRAM') ?? null;
        setInstagramAccount(account);

        if (account && !account.needsReauth) {
          await loadMedia();
        }
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
  }, [router, loadMedia]);

  if (loading) {
    return (
      <main className="relative mx-auto max-w-3xl px-4 py-10">
        <AnimatedBackground intensity="low" />
        <Skeleton className="mb-8 h-9 w-56" />
        <div className="space-y-8">
          <ProfileCardSkeleton />
          <div className="rounded-xl border border-border bg-surface/60 p-6">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-9 w-40 rounded-md" />
            </div>
          </div>
          <InstagramMediaSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10">
      <AnimatedBackground intensity="low" />

      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Instagram</h1>
          <p className="mt-1 text-sm text-ink-soft">Publish Reels to your connected account</p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-soft transition hover:text-ink">
          ← Dashboard
        </Link>
      </motion.div>

      {!instagramAccount ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          No Instagram account connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect Instagram from the dashboard
          </Link>{' '}
          to publish here.
        </div>
      ) : instagramAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          Your Instagram connection needs to be renewed.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-8">
          <InstagramAccountCard account={instagramAccount} />
          <InstagramPublishForm onPublished={loadMedia} />

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Recent media</h2>
              <button
                type="button"
                onClick={loadMedia}
                disabled={mediaLoading}
                className="flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink disabled:opacity-50"
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={mediaLoading ? { rotate: 360 } : { rotate: 0 }}
                  transition={mediaLoading ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : smooth}
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                </motion.svg>
                Refresh
              </button>
            </div>

            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300"
                >
                  {error}{' '}
                  <button type="button" onClick={loadMedia} className="font-medium underline">
                    Try again
                  </button>
                </motion.div>
              ) : mediaLoading ? (
                <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <InstagramMediaSkeleton />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <InstagramMediaList items={media} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </main>
  );
}
