'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LinkedInPostForm } from '@/components/linkedin-post-form';
import { LinkedInPostList } from '@/components/linkedin-post-list';
import { LinkedInProfileCard } from '@/components/linkedin-profile-card';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkedInPostsSkeleton, ProfileCardSkeleton } from '@/components/ui/skeletons';
import {
  ApiError,
  getCurrentUser,
  getLinkedInProfile,
  listLinkedInPosts,
  listSocialAccounts,
} from '@/lib/api';
import { fadeUp } from '@/lib/motion';
import type { LinkedInPost, LinkedInProfile, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  quota_exceeded: 'LinkedIn rate limit reached. Please try again shortly.',
  network_error: 'A network error occurred while contacting LinkedIn. Please try again.',
};

export default function LinkedInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [linkedInAccount, setLinkedInAccount] = useState<SocialAccount | null>(null);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      const { posts } = await listLinkedInPosts();
      setPosts(posts);
    } catch {
      // non-fatal — the post list just won't refresh
    }
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [{ profile }, { posts }] = await Promise.all([getLinkedInProfile(), listLinkedInPosts()]);
      setProfile(profile);
      setPosts(posts);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading LinkedIn.');
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
        const account = accounts.find((a) => a.platform === 'LINKEDIN') ?? null;
        setLinkedInAccount(account);

        if (account && !account.needsReauth) {
          await loadAll();
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
  }, [router, loadAll]);

  function handlePostUpdated(updated: LinkedInPost) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  if (loading) {
    return (
      <main className="relative mx-auto max-w-3xl px-4 py-10">
        <AnimatedBackground intensity="low" />
        <Skeleton className="mb-8 h-9 w-56" />
        <div className="space-y-8">
          <ProfileCardSkeleton />
          <div className="rounded-xl border border-border bg-surface/60 p-6">
            <Skeleton className="h-5 w-24" />
            <div className="mt-4 space-y-4">
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
          <LinkedInPostsSkeleton />
        </div>
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
          <h1 className="text-2xl font-semibold text-ink">LinkedIn</h1>
          <p className="mt-1 text-sm text-ink-soft">Your profile and posts</p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-soft transition hover:text-ink">
          ← Dashboard
        </Link>
      </motion.div>

      {!linkedInAccount ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          No LinkedIn account connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect LinkedIn from the dashboard
          </Link>{' '}
          to view your profile and post here.
        </div>
      ) : linkedInAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          Your LinkedIn connection needs to be renewed.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">
          {error}{' '}
          <button type="button" onClick={loadAll} className="font-medium underline">
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {profile && <LinkedInProfileCard profile={profile} />}
          <LinkedInPostForm onCreated={loadPosts} />
          <LinkedInPostList posts={posts} onPostUpdated={handlePostUpdated} />
        </div>
      )}
    </main>
  );
}
