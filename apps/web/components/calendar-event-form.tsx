'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, createCalendarEvent } from '@/lib/api';
import { smooth, spring } from '@/lib/motion';

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No Google Calendar account connected. Connect it from the dashboard first.',
  reauth_required: 'Reconnect Google Calendar from the dashboard — permission is missing or expired.',
  quota_exceeded: 'Google Calendar rate limit reached, try again shortly.',
  network_error: 'A network error occurred. Please try again.',
};

/** Converts a <input type="datetime-local"> value (local wall-clock time, no timezone)
 * into a proper ISO 8601 string Google's API accepts. */
function toIso(localDateTime: string): string | null {
  if (!localDateTime) return null;
  const date = new Date(localDateTime);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function CalendarEventForm({ onCreated }: { onCreated?: () => void }) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = summary.trim().length > 0 && !!start && !!end && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startIso = toIso(start);
    const endIso = toIso(end);
    if (!startIso || !endIso) {
      setError('Please provide a valid start and end time.');
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setError('End time must be after the start time.');
      return;
    }

    setSubmitting(true);
    try {
      await createCalendarEvent({
        summary: summary.trim(),
        description: description.trim() || undefined,
        startDateTime: startIso,
        endDateTime: endIso,
      });
      setSummary('');
      setDescription('');
      setStart('');
      setEnd('');
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Failed to create the event.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
      <h2 className="text-base font-semibold text-ink">Create Event</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-ink-soft">
            Title
          </label>
          <input
            id="summary"
            type="text"
            value={summary}
            maxLength={200}
            onChange={(e) => setSummary(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-ink-soft">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            maxLength={5000}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="start" className="block text-sm font-medium text-ink-soft">
              Start
            </label>
            <input
              id="start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="end" className="block text-sm font-medium text-ink-soft">
              End
            </label>
            <input
              id="end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={submitting}
              className={inputClass}
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={smooth}
              className="overflow-hidden rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={!canSubmit}
          whileTap={canSubmit ? { scale: 0.97 } : undefined}
          transition={spring}
          className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Event'}
        </motion.button>
      </form>
    </section>
  );
}
