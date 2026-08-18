'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, connectYouTubeUrl, disconnectSocialAccount } from '@/lib/api';
import type { SocialAccount } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

export function ConnectedAccounts({ initialAccounts }: { initialAccounts: SocialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const youtube = accounts.find((a) => a.platform === 'YOUTUBE');

  async function handleDisconnect(account: SocialAccount) {
    setError(null);
    setDisconnectingId(account.id);
    try {
      await disconnectSocialAccount(account.platform, account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disconnect this account.');
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-ink">Connected Accounts</h2>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-rose-500/20 bg-rose-500/10 px-6 py-3 text-sm text-rose-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="divide-y divide-border">
        <motion.li variants={fadeUp} className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <YouTubeIcon />
            <div>
              <p className="font-medium text-ink">YouTube</p>
              <AnimatePresence mode="wait">
                {youtube ? (
                  <motion.div
                    key={youtube.needsReauth ? 'reauth' : 'connected'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 text-sm text-ink-soft"
                  >
                    {youtube.needsReauth ? (
                      <span className="text-amber-400">Reconnect required — permissions expired or revoked</span>
                    ) : (
                      <>
                        <span className="font-medium text-emerald-400">Connected ✓</span>
                        {youtube.displayName && <span className="ml-2">Channel: {youtube.displayName}</span>}
                        <span className="ml-2 text-ink-faint">ID: {youtube.platformUserId}</span>
                      </>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    key="not-connected"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 text-sm text-ink-soft"
                  >
                    Not connected
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {youtube ? (
            youtube.needsReauth ? (
              <a
                href={connectYouTubeUrl()}
                className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
              >
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleDisconnect(youtube)}
                disabled={disconnectingId === youtube.id}
                className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-rose-400/40 hover:text-rose-300 active:scale-95 disabled:opacity-50"
              >
                {disconnectingId === youtube.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )
          ) : (
            <a
              href={connectYouTubeUrl()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(220,38,38,0.6)] transition hover:bg-red-500 active:scale-95"
            >
              Connect YouTube
            </a>
          )}
        </motion.li>

        <PlaceholderRow label="Instagram" />
        <PlaceholderRow label="Facebook" />
      </motion.ul>
    </section>
  );
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <motion.li variants={fadeUp} className="flex items-center justify-between gap-4 px-6 py-5 opacity-40">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div>
          <p className="font-medium text-ink">{label}</p>
          <p className="mt-0.5 text-sm text-ink-soft">Coming soon</p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-md border border-border px-4 py-2 text-sm font-medium text-ink-faint"
      >
        Connect {label}
      </button>
    </motion.li>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-500" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.4 3.6-6.4 3.6Z" />
    </svg>
  );
}
