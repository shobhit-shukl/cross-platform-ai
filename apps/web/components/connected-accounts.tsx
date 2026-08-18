'use client';

import { useState } from 'react';
import { ApiError, connectYouTubeUrl, disconnectSocialAccount } from '@/lib/api';
import type { SocialAccount } from '@/lib/types';

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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Connected Accounts</h2>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">{error}</div>
      )}

      <ul className="divide-y divide-slate-100">
        <li className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <YouTubeIcon />
            <div>
              <p className="font-medium text-slate-900">YouTube</p>
              {youtube ? (
                <div className="mt-0.5 text-sm text-slate-500">
                  {youtube.needsReauth ? (
                    <span className="text-amber-600">Reconnect required — permissions expired or revoked</span>
                  ) : (
                    <>
                      <span className="font-medium text-emerald-600">Connected ✓</span>
                      {youtube.displayName && <span className="ml-2">Channel: {youtube.displayName}</span>}
                      <span className="ml-2 text-slate-400">ID: {youtube.platformUserId}</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-slate-500">Not connected</p>
              )}
            </div>
          </div>

          {youtube ? (
            youtube.needsReauth ? (
              <a
                href={connectYouTubeUrl()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleDisconnect(youtube)}
                disabled={disconnectingId === youtube.id}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {disconnectingId === youtube.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )
          ) : (
            <a
              href={connectYouTubeUrl()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Connect YouTube
            </a>
          )}
        </li>

        <PlaceholderRow label="Instagram" />
        <PlaceholderRow label="Facebook" />
      </ul>
    </section>
  );
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-5 opacity-50">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-slate-200" />
        <div>
          <p className="font-medium text-slate-900">{label}</p>
          <p className="mt-0.5 text-sm text-slate-500">Coming soon</p>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
      >
        Connect {label}
      </button>
    </li>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-600" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.4 3.6-6.4 3.6Z" />
    </svg>
  );
}
