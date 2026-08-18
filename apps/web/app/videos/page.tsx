'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VideoGrid } from '@/components/video-grid';
import {
  ApiError,
  getCurrentUser,
  listPublishingJobs,
  listSocialAccounts,
  listYouTubeVideos,
} from '@/lib/api';
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
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your Videos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {youtubeAccount?.displayName ? `From ${youtubeAccount.displayName}` : 'Videos on your connected channel'}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
          ← Dashboard
        </Link>
      </div>

      {!youtubeAccount ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No YouTube account connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect YouTube from the dashboard
          </Link>{' '}
          to see your videos here.
        </div>
      ) : youtubeAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Your YouTube connection needs to be renewed before we can list your videos.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}{' '}
          <button type="button" onClick={loadFirstPage} className="font-medium underline">
            Try again
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">No videos found on this channel yet.</p>
          <Link
            href="/create"
            className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
                className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
