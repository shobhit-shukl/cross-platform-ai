'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, createLinkedInPost } from '@/lib/api';
import type { LinkedInVisibility } from '@/lib/types';
import { smooth, spring } from '@/lib/motion';

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No LinkedIn account connected. Connect it from the dashboard first.',
  reauth_required: 'Reconnect LinkedIn from the dashboard — permission is missing or expired.',
  quota_exceeded: 'LinkedIn rate limit reached, try again shortly.',
  not_configured: 'LinkedIn is not set up on this server yet.',
  network_error: 'A network error occurred. Please try again.',
};

const MAX_LENGTH = 3000;

export function LinkedInPostForm({ onCreated }: { onCreated?: () => void }) {
  const [commentary, setCommentary] = useState('');
  const [visibility, setVisibility] = useState<LinkedInVisibility>('PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = commentary.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createLinkedInPost(commentary.trim(), visibility);
      setCommentary('');
      setVisibility('PUBLIC');
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Failed to create the post.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
      <h2 className="text-base font-semibold text-ink">Create Post</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="commentary" className="block text-sm font-medium text-ink-soft">
            What do you want to share?
          </label>
          <textarea
            id="commentary"
            value={commentary}
            maxLength={MAX_LENGTH}
            rows={5}
            onChange={(e) => setCommentary(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
          <p className="mt-1 text-right text-xs text-ink-faint">
            {commentary.length}/{MAX_LENGTH}
          </p>
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-ink-soft">
            Visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as LinkedInVisibility)}
            disabled={submitting}
            className={inputClass}
          >
            <option value="PUBLIC">Public — anyone on LinkedIn</option>
            <option value="CONNECTIONS">Connections only</option>
          </select>
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
          className="rounded-md bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(10,102,194,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Publish to LinkedIn'}
        </motion.button>
      </form>
    </section>
  );
}
