'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import {
  ApiError,
  connectGoogleCalendarUrl,
  connectGoogleDriveUrl,
  connectYouTubeUrl,
  disconnectSocialAccount,
} from '@/lib/api';
import type { SocialAccount } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

export function ConnectedAccounts({ initialAccounts }: { initialAccounts: SocialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const youtube = accounts.find((a) => a.platform === 'YOUTUBE');
  const googleDrive = accounts.find((a) => a.platform === 'GOOGLE_DRIVE');
  const googleCalendar = accounts.find((a) => a.platform === 'GOOGLE_CALENDAR');

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

        <motion.li variants={fadeUp} className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <DriveIcon />
            <div>
              <p className="font-medium text-ink">Google Drive</p>
              <AnimatePresence mode="wait">
                {googleDrive ? (
                  <motion.div
                    key={googleDrive.needsReauth ? 'reauth' : 'connected'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 text-sm text-ink-soft"
                  >
                    {googleDrive.needsReauth ? (
                      <span className="text-amber-400">Reconnect required — permissions expired or revoked</span>
                    ) : (
                      <>
                        <span className="font-medium text-emerald-400">Connected ✓</span>
                        {googleDrive.displayName && <span className="ml-2">{googleDrive.displayName}</span>}
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

          {googleDrive ? (
            googleDrive.needsReauth ? (
              <a
                href={connectGoogleDriveUrl()}
                className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
              >
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleDisconnect(googleDrive)}
                disabled={disconnectingId === googleDrive.id}
                className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-rose-400/40 hover:text-rose-300 active:scale-95 disabled:opacity-50"
              >
                {disconnectingId === googleDrive.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )
          ) : (
            <a
              href={connectGoogleDriveUrl()}
              className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
            >
              Connect Google Drive
            </a>
          )}
        </motion.li>

        <motion.li variants={fadeUp} className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <CalendarIcon />
            <div>
              <p className="font-medium text-ink">Google Calendar</p>
              <AnimatePresence mode="wait">
                {googleCalendar ? (
                  <motion.div
                    key={googleCalendar.needsReauth ? 'reauth' : 'connected'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 text-sm text-ink-soft"
                  >
                    {googleCalendar.needsReauth ? (
                      <span className="text-amber-400">Reconnect required — permissions expired or revoked</span>
                    ) : (
                      <>
                        <span className="font-medium text-emerald-400">Connected ✓</span>
                        {googleCalendar.displayName && <span className="ml-2">{googleCalendar.displayName}</span>}
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

          {googleCalendar ? (
            googleCalendar.needsReauth ? (
              <a
                href={connectGoogleCalendarUrl()}
                className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
              >
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleDisconnect(googleCalendar)}
                disabled={disconnectingId === googleCalendar.id}
                className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-rose-400/40 hover:text-rose-300 active:scale-95 disabled:opacity-50"
              >
                {disconnectingId === googleCalendar.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )
          ) : (
            <a
              href={connectGoogleCalendarUrl()}
              className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
            >
              Connect Google Calendar
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

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <path d="M8.05 3.5 1.5 15l3.3 5.7 6.55-11.5-3.3-5.7Z" fill="#00AC47" />
      <path d="M15.95 3.5H8.05l3.3 5.7h7.9l-3.3-5.7Z" fill="#EA4335" />
      <path d="M4.8 20.7h14.4l3.3-5.7H8.1l-3.3 5.7Z" fill="#4285F4" />
      <path d="M11.85 9.2h7.9l3.3 5.7h-7.9l-3.3-5.7Z" fill="#FFBA00" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" fill="#fff" stroke="#DADCE0" />
      <rect x="3" y="4.5" width="18" height="4" rx="2" fill="#1A73E8" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#1A73E8" fontFamily="sans-serif">
        31
      </text>
    </svg>
  );
}
