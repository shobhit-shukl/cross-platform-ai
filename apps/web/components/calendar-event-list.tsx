'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, deleteCalendarEvent } from '@/lib/api';
import type { CalendarEvent } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

function formatEventTime(startIso: string | undefined, endIso: string | undefined): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  const dateLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const startLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (!endIso) return `${dateLabel} · ${startLabel}`;
  const end = new Date(endIso);
  const endLabel = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${startLabel} – ${endLabel}`;
}

export function CalendarEventList({
  events,
  onEventDeleted,
}: {
  events: CalendarEvent[];
  onEventDeleted: (eventId: string) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(event: CalendarEvent) {
    setError(null);
    setDeletingId(event.eventId);
    try {
      await deleteCalendarEvent(event.eventId);
      onEventDeleted(event.eventId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.errorCode === 'reauth_required'
            ? 'Reconnect Google Calendar from the dashboard to manage events.'
            : err.message
          : 'Failed to delete this event.',
      );
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-10 text-center backdrop-blur">
        <p className="text-sm text-ink-soft">No upcoming events.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur">
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
        {events.map((event) => {
          const isConfirming = confirmingId === event.eventId;
          const isDeleting = deletingId === event.eventId;

          return (
            <motion.li
              key={event.eventId}
              variants={fadeUp}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-brand-gradient text-white">
                  <span className="text-[10px] font-medium uppercase leading-none">
                    {event.startDateTime
                      ? new Date(event.startDateTime).toLocaleDateString(undefined, { month: 'short' })
                      : '—'}
                  </span>
                  <span className="text-base font-bold leading-tight">
                    {event.startDateTime ? new Date(event.startDateTime).getDate() : '?'}
                  </span>
                </div>
                <div className="min-w-0">
                  {event.htmlLink ? (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium text-ink hover:underline"
                    >
                      {event.summary}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium text-ink">{event.summary}</p>
                  )}
                  <p className="text-xs text-ink-faint">{formatEventTime(event.startDateTime, event.endDateTime)}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <AnimatePresence mode="wait">
                  {isConfirming ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-ink-soft">Delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(event)}
                        disabled={isDeleting}
                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
                      >
                        {isDeleting ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={isDeleting}
                        className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="delete"
                      type="button"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setConfirmingId(event.eventId)}
                      className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-rose-400/40 hover:text-rose-300"
                    >
                      Delete
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
