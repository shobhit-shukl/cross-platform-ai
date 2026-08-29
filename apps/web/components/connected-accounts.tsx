'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  ApiError,
  connectGoogleCalendarUrl,
  connectGoogleDriveUrl,
  connectLinkedInUrl,
  connectYouTubeUrl,
  disconnectSocialAccount,
  listPublishingJobs,
} from '@/lib/api';
import type { Platform, SocialAccount } from '@/lib/types';
import { fadeUp, smooth, staggerContainer } from '@/lib/motion';

interface QuickAction {
  label: string;
  href: string;
  primary?: boolean;
}

interface PlatformConfig {
  id: Platform;
  label: string;
  Icon: ComponentType;
  connectUrl: () => string;
  /** Brand-coloured Connect button; defaults to the app gradient. */
  connectClass?: string;
  glow: string;
  /** Tools surfaced inline when the card is expanded. */
  actions: QuickAction[];
  /** Extra identity line, e.g. the YouTube channel id. */
  detail?: (account: SocialAccount) => ReactNode;
}

/**
 * Single source of truth for the account list. Previously each platform was ~65 lines
 * of near-identical JSX; making it data-driven means the expand/collapse behaviour,
 * accessibility wiring and animation are written once instead of four times, and adding
 * Instagram later is one array entry.
 */
const PLATFORMS: PlatformConfig[] = [
  {
    id: 'YOUTUBE',
    label: 'YouTube',
    Icon: YouTubeIcon,
    connectUrl: connectYouTubeUrl,
    connectClass: 'bg-red-600 hover:bg-red-500 shadow-[0_0_20px_-6px_rgba(220,38,38,0.6)]',
    glow: 'rgba(239,68,68,0.10)',
    actions: [
      { label: 'Upload a video', href: '/create', primary: true },
      { label: 'Your videos', href: '/videos' },
    ],
    detail: (a) => <>Channel ID: {a.platformUserId}</>,
  },
  {
    id: 'GOOGLE_DRIVE',
    label: 'Google Drive',
    Icon: DriveIcon,
    connectUrl: connectGoogleDriveUrl,
    glow: 'rgba(52,211,153,0.10)',
    actions: [
      { label: 'Upload a file', href: '/drive', primary: true },
      { label: 'Browse files', href: '/drive' },
    ],
  },
  {
    id: 'GOOGLE_CALENDAR',
    label: 'Google Calendar',
    Icon: CalendarIcon,
    connectUrl: connectGoogleCalendarUrl,
    glow: 'rgba(59,130,246,0.10)',
    actions: [
      { label: 'Create an event', href: '/calendar', primary: true },
      { label: 'Upcoming events', href: '/calendar' },
    ],
  },
  {
    id: 'LINKEDIN',
    label: 'LinkedIn',
    Icon: LinkedInIcon,
    connectUrl: connectLinkedInUrl,
    connectClass: 'bg-[#0A66C2] hover:brightness-110 shadow-[0_0_20px_-6px_rgba(10,102,194,0.6)]',
    glow: 'rgba(10,102,194,0.10)',
    actions: [
      { label: 'Write a post', href: '/linkedin', primary: true },
      { label: 'Profile & posts', href: '/linkedin' },
    ],
  },
];

export function ConnectedAccounts({ initialAccounts }: { initialAccounts: SocialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Single-open accordion: tracking one id rather than a Set keeps the list compact,
  // which matters more here than letting several platforms sit open at once.
  const [expandedId, setExpandedId] = useState<Platform | null>(null);

  // Real published count for the YouTube card, fetched only once a card is actually
  // opened — no request at all for users who never expand anything.
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  useEffect(() => {
    if (expandedId !== 'YOUTUBE' || publishedCount !== null) return;
    let cancelled = false;
    listPublishingJobs(50)
      .then(({ jobs }) => {
        if (!cancelled) setPublishedCount(jobs.filter((j) => j.status === 'PUBLISHED').length);
      })
      // Non-fatal: the stat line just stays hidden rather than breaking the card.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [expandedId, publishedCount]);

  async function handleDisconnect(account: SocialAccount) {
    setError(null);
    setDisconnectingId(account.id);
    try {
      await disconnectSocialAccount(account.platform, account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      // A disconnected card has nothing to show, so collapse it.
      setExpandedId((cur) => (cur === account.platform ? null : cur));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disconnect this account.');
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-surface/60 backdrop-blur">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-semibold text-ink">Connected Accounts</h2>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-rose-500/20 bg-rose-500/10 px-6 py-3 text-sm text-rose-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="divide-y divide-white/10">
        {PLATFORMS.map((platform) => (
          <PlatformRow
            key={platform.id}
            platform={platform}
            account={accounts.find((a) => a.platform === platform.id)}
            expanded={expandedId === platform.id}
            onToggle={() => setExpandedId((cur) => (cur === platform.id ? null : platform.id))}
            disconnecting={disconnectingId}
            onDisconnect={handleDisconnect}
            publishedCount={platform.id === 'YOUTUBE' ? publishedCount : null}
          />
        ))}

        <PlaceholderRow label="Instagram" />
        <PlaceholderRow label="Facebook" />
      </motion.ul>
    </section>
  );
}

function PlatformRow({
  platform,
  account,
  expanded,
  onToggle,
  disconnecting,
  onDisconnect,
  publishedCount,
}: {
  platform: PlatformConfig;
  account?: SocialAccount;
  expanded: boolean;
  onToggle: () => void;
  disconnecting: string | null;
  onDisconnect: (a: SocialAccount) => void;
  publishedCount: number | null;
}) {
  const { Icon, label, actions, detail, connectUrl, connectClass, glow } = platform;
  // Only a healthy connection has tools worth revealing. A card needing reauth shows
  // the Reconnect action instead — expanding to offer "Upload a video" would just lead
  // to a failure the user can't act on from inside the panel.
  const isExpandable = Boolean(account) && !account?.needsReauth;
  const panelId = `panel-${platform.id}`;

  return (
    <motion.li variants={fadeUp} className="relative">
      {/* Cursor-glow tint, only while this row is the open one. */}
      {expanded && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(90deg, ${glow}, transparent 60%)` }}
        />
      )}

      <div
        className={`relative flex items-center justify-between gap-4 px-6 py-5 transition-colors duration-300 ${
          isExpandable ? 'cursor-pointer hover:bg-white/[0.025]' : ''
        }`}
        // The whole row is clickable, but only when there's something to reveal.
        onClick={isExpandable ? onToggle : undefined}
      >
        <div className="flex min-w-0 items-center gap-4">
          <Icon />
          <div className="min-w-0">
            <p className="font-medium text-ink">{label}</p>
            <AnimatePresence mode="wait">
              {account ? (
                <motion.div
                  key={account.needsReauth ? 'reauth' : 'connected'}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-0.5 truncate text-sm text-ink-soft"
                >
                  {account.needsReauth ? (
                    <span className="text-amber-400">Reconnect required — permissions expired or revoked</span>
                  ) : (
                    <>
                      <span className="font-medium text-emerald-400">Connected ✓</span>
                      {account.displayName && <span className="ml-2">{account.displayName}</span>}
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

        {/* stopPropagation on the controls: without it, clicking Disconnect would also
            bubble to the row and toggle the accordion at the same time. */}
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {account ? (
            account.needsReauth ? (
              <a
                href={connectUrl()}
                className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 active:scale-95"
              >
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onDisconnect(account)}
                disabled={disconnecting === account.id}
                className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-rose-400/40 hover:text-rose-300 active:scale-95 disabled:opacity-50"
              >
                {disconnecting === account.id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )
          ) : (
            <a
              href={connectUrl()}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white transition active:scale-95 ${
                connectClass ?? 'bg-brand-gradient hover:brightness-110 shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)]'
              }`}
            >
              Connect {label}
            </a>
          )}

          {isExpandable && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label} tools`}
              className="rounded-md p-2 text-ink-faint transition hover:bg-white/5 hover:text-ink"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={smooth}
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </motion.svg>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && account && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={smooth}
            className="relative overflow-hidden"
          >
            <div className="border-t border-white/5 bg-black/30 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                {actions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`rounded-lg px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                      action.primary
                        ? 'bg-brand-gradient text-white shadow-[0_0_18px_-6px_rgba(139,92,246,0.7)] hover:brightness-110'
                        : 'border border-white/10 text-ink-soft hover:border-white/25 hover:text-ink'
                    }`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>

              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
                {publishedCount !== null && (
                  <div>
                    <dt className="text-ink-faint">Published via CrossPost AI</dt>
                    <dd className="mt-0.5 font-medium text-ink">{publishedCount}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-ink-faint">Connected</dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                {detail && (
                  <div className="min-w-0">
                    <dt className="text-ink-faint">Account</dt>
                    <dd className="mt-0.5 truncate font-medium text-ink">{detail(account)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
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
        className="cursor-not-allowed rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-ink-faint"
      >
        Connect {label}
      </button>
    </motion.li>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-red-500" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.4 3.6-6.4 3.6Z" />
    </svg>
  );
}

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true">
      <path d="M8.05 3.5 1.5 15l3.3 5.7 6.55-11.5-3.3-5.7Z" fill="#00AC47" />
      <path d="M15.95 3.5H8.05l3.3 5.7h7.9l-3.3-5.7Z" fill="#EA4335" />
      <path d="M4.8 20.7h14.4l3.3-5.7H8.1l-3.3 5.7Z" fill="#4285F4" />
      <path d="M11.85 9.2h7.9l3.3 5.7h-7.9l-3.3-5.7Z" fill="#FFBA00" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" fill="#fff" stroke="#DADCE0" />
      <rect x="3" y="4.5" width="18" height="4" rx="2" fill="#1A73E8" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#1A73E8" fontFamily="sans-serif">
        31
      </text>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-[#0A66C2]" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}
