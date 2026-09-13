'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstagramPublishForm } from '@/components/instagram-publish-form';
import { InstagramMediaList } from '@/components/instagram-media-list';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveFilesSkeleton } from '@/components/ui/skeletons';
import { ApiError, getCurrentUser, listInstagramMedia, listSocialAccounts } from '@/lib/api';
import { fadeUp } from '@/lib/motion';
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
  const [error, setError] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setError(null);
    try {
      const { items } = await listInstagramMedia();
      setMedia(items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading Instagram media.');
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
        <DriveFilesSkeleton />
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
          <InstagramPublishForm onPublished={loadMedia} />
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">
              {error}{' '}
              <button type="button" onClick={loadMedia} className="font-medium underline">
                Try again
              </button>
            </div>
          ) : (
            <InstagramMediaList items={media} />
          )}
        </div>
      )}
    </main>
  );
}
