'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DriveFileList } from '@/components/drive-file-list';
import { DriveUploadForm } from '@/components/drive-upload-form';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveFilesSkeleton } from '@/components/ui/skeletons';
import { ApiError, getCurrentUser, listDriveFiles, listSocialAccounts } from '@/lib/api';
import { fadeUp } from '@/lib/motion';
import type { DriveFile, SocialAccount } from '@/lib/types';

const ERROR_MESSAGES: Record<string, string> = {
  quota_exceeded: 'Google Drive storage quota reached.',
  network_error: 'A network error occurred while contacting Google Drive. Please try again.',
};

export default function DrivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [driveAccount, setDriveAccount] = useState<SocialAccount | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setError(null);
    try {
      const { items, nextPageToken } = await listDriveFiles();
      setFiles(items);
      setNextPageToken(nextPageToken);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Something went wrong loading your files.');
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
        const account = accounts.find((a) => a.platform === 'GOOGLE_DRIVE') ?? null;
        setDriveAccount(account);

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
      const { items, nextPageToken: next } = await listDriveFiles({ pageToken: nextPageToken });
      setFiles((prev) => [...prev, ...items]);
      setNextPageToken(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more files.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleFileDeleted(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  }

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

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-ink">Google Drive</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {driveAccount?.displayName ? `Connected as ${driveAccount.displayName}` : 'Files uploaded through CrossPost AI'}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-soft transition hover:text-ink">
          ← Dashboard
        </Link>
      </motion.div>

      {!driveAccount ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          No Google Drive account connected.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Connect Google Drive from the dashboard
          </Link>{' '}
          to upload and manage files here.
        </div>
      ) : driveAccount.needsReauth ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-300">
          Your Google Drive connection needs to be renewed.{' '}
          <Link href="/dashboard" className="font-medium underline">
            Reconnect from the dashboard
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-8">
          <DriveUploadForm onUploaded={loadFirstPage} />

          <p className="text-xs text-ink-faint">
            Only files uploaded through CrossPost AI appear here — the connection is
            scoped to files this app creates, not your whole Drive.
          </p>

          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300">
              {error}{' '}
              <button type="button" onClick={loadFirstPage} className="font-medium underline">
                Try again
              </button>
            </div>
          ) : (
            <>
              <DriveFileList files={files} onFileDeleted={handleFileDeleted} />
              {nextPageToken && (
                <div className="flex justify-center">
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
        </div>
      )}
    </main>
  );
}
