'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublishForm } from '@/components/publish-form';
import { PublishingJobsList } from '@/components/publishing-jobs-list';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser, listPublishingJobs, listSocialAccounts } from '@/lib/api';
import { fadeUp } from '@/lib/motion';
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
    return (
      <main className="relative mx-auto max-w-3xl px-4 py-10">
        <AnimatedBackground intensity="low" />
        <Skeleton className="mb-8 h-9 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
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
          <h1 className="text-2xl font-semibold text-ink">Create Post</h1>
          <p className="mt-1 text-sm text-ink-soft">Upload a video and publish it to YouTube.</p>
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
          before publishing.
        </div>
      ) : youtubeAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
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
