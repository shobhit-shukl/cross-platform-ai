'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublishForm } from '@/components/publish-form';
import { PublishingJobsList } from '@/components/publishing-jobs-list';
import { getCurrentUser, listPublishingJobs, listSocialAccounts } from '@/lib/api';
import type { PublishingJob, SocialAccount } from '@/lib/types';

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [youtubeAccount, setYoutubeAccount] = useState<SocialAccount | null>(null);
  const [jobs, setJobs] = useState<PublishingJob[]>([]);

  const refreshJobs = useCallback(async () => {
    try {
      const { jobs } = await listPublishingJobs();
      setJobs(jobs);
    } catch {
      // non-fatal — the recent list just won't refresh
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await getCurrentUser();
        const { accounts } = await listSocialAccounts();
        if (cancelled) return;
        setYoutubeAccount(accounts.find((a) => a.platform === 'YOUTUBE') ?? null);
        await refreshJobs();
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
  }, [router, refreshJobs]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Create Post</h1>
          <p className="mt-1 text-sm text-slate-500">Upload a video and publish it to YouTube.</p>
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
          before publishing.
        </div>
      ) : youtubeAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Your YouTube connection needs to be renewed before you can publish.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-8">
          <PublishForm onJobSettled={refreshJobs} />
          <PublishingJobsList jobs={jobs} />
        </div>
      )}
    </main>
  );
}
