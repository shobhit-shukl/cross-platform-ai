'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FacebookPageCard } from '@/components/facebook-page-card';
import { FacebookPublishForm } from '@/components/facebook-publish-form';
import { FacebookVideoList } from '@/components/facebook-video-list';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookVideosSkeleton, ProfileCardSkeleton } from '@/components/ui/skeletons';
import { ApiError, getCurrentUser, listFacebookVideos, listSocialAccounts } from '@/lib/api';
import { fadeUp, smooth } from '@/lib/motion';
import type { FacebookVideo, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  quota_exceeded: 'Facebook rate limit reached. Please try again shortly.',
  network_error: 'A network error occurred while contacting Facebook. Please try again.',
};

export default function FacebookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [facebookAccount, setFacebookAccount] = useState<SocialAccount | null>(null);
  const [videos, setVideos] = useState<FacebookVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    setError(null);
    setVideosLoading(true);
    try {
      const { items } = await listFacebookVideos();
      setVideos(items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading Facebook videos.');
      }
    } finally {
      setVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await getCurrentUser();
        const { accounts } = await listSocialAccounts();
        if (cancelled) return;
        const account = accounts.find((a) => a.platform === 'FACEBOOK') ?? null;
        setFacebookAccount(account);

        if (account && !account.needsReauth) {
          await loadVideos();
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
  }, [router, loadVideos]);

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
          <FacebookVideosSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10">
      <AnimatedBackground intensity="low" />

      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Facebook</h1>
          <p className="mt-1 text-sm text-ink-soft">Publish videos to your connected Page</p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-soft transition hover:text-ink">
          ← Dashboard
        </Link>
      </motion.div>

      {!facebookAccount ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          No Facebook Page connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect Facebook from the dashboard
          </Link>{' '}
          to publish here.
        </div>
      ) : facebookAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          Your Facebook connection needs to be renewed.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-8">
          <FacebookPageCard account={facebookAccount} />
          <FacebookPublishForm onPublished={loadVideos} />

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">Recent videos</h2>
              <button
                type="button"
                onClick={loadVideos}
                disabled={videosLoading}
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
                  animate={videosLoading ? { rotate: 360 } : { rotate: 0 }}
                  transition={videosLoading ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : smooth}
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
                  <button type="button" onClick={loadVideos} className="font-medium underline">
                    Try again
                  </button>
                </motion.div>
              ) : videosLoading ? (
                <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <FacebookVideosSkeleton />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <FacebookVideoList videos={videos} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </main>
  );
}
