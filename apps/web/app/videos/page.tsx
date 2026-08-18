'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoGrid } from '@/components/video-grid';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoGridSkeleton } from '@/components/ui/skeletons';
import {
  ApiError,
  getCurrentUser,
  listPublishingJobs,
  listSocialAccounts,
  listYouTubeVideos,
} from '@/lib/api';
import { fadeUp } from '@/lib/motion';
import type { ExternalPost, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  quota_exceeded: 'Daily YouTube quota reached. Please try again tomorrow.',
  network_error: 'A network error occurred while contacting YouTube. Please try again.',
};

export default function VideosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [youtubeAccount, setYoutubeAccount] = useState<SocialAccount | null>(null);
  const [videos, setVideos] = useState<ExternalPost[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedViaAppIds, setPublishedViaAppIds] = useState<Set<string>>(new Set());

  const loadFirstPage = useCallback(async () => {
    setError(null);
    try {
      const [{ items, nextPageToken }, { jobs }] = await Promise.all([
        listYouTubeVideos(),
        listPublishingJobs(50).catch(() => ({ jobs: [] })),
      ]);
      setVideos(items);
      setNextPageToken(nextPageToken);
      setPublishedViaAppIds(
        new Set(
          jobs
            .filter((j) => j.status === 'PUBLISHED' && j.platformPostId)
            .map((j) => j.platformPostId as string),
        ),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading your videos.');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await getCurrentUser();
        const { accounts } = await listSocialAccounts();
        if (cancelled) return;
        const account = accounts.find((a) => a.platform === 'YOUTUBE') ?? null;
        setYoutubeAccount(account);

        if (account && !account.needsReauth) {
          await loadFirstPage();
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
  }, [router, loadFirstPage]);

  async function handleLoadMore() {
    if (!nextPageToken) return;
    setLoadingMore(true);
    try {
      const { items, nextPageToken: next } = await listYouTubeVideos({ pageToken: nextPageToken });
      setVideos((prev) => [...prev, ...items]);
      setNextPageToken(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more videos.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <main className="relative mx-auto max-w-6xl px-4 py-10">
        <AnimatedBackground intensity="low" />
        <Skeleton className="mb-8 h-9 w-56" />
        <VideoGridSkeleton />
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-6xl px-4 py-10">
      <AnimatedBackground intensity="low" />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-ink">Your Videos</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {youtubeAccount?.displayName ? `From ${youtubeAccount.displayName}` : 'Videos on your connected channel'}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-soft transition hover:text-ink">
          ← Dashboard
        </Link>
      </motion.div>

      {!youtubeAccount ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          No YouTube account connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect YouTube from the dashboard
          </Link>{' '}
          to see your videos here.
        </div>
      ) : youtubeAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          Your YouTube connection needs to be renewed before we can list your videos.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">
          {error}{' '}
          <button type="button" onClick={loadFirstPage} className="font-medium underline">
            Try again
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface/60 p-10 text-center backdrop-blur">
          <p className="text-sm text-ink-soft">No videos found on this channel yet.</p>
          <Link
            href="/create"
            className="mt-3 inline-block rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
          >
            Publish your first video
          </Link>
        </div>
      ) : (
        <>
          <VideoGrid videos={videos} publishedViaAppIds={publishedViaAppIds} />
          {nextPageToken && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-md border border-border-strong bg-surface/60 px-5 py-2 text-sm font-medium text-ink-soft backdrop-blur transition hover:text-ink active:scale-95 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
