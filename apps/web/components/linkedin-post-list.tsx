'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, editLinkedInPost } from '@/lib/api';
import type { LinkedInPost } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No LinkedIn account connected.',
  reauth_required: 'Reconnect LinkedIn from the dashboard to edit posts.',
  quota_exceeded: 'LinkedIn rate limit reached, try again shortly.',
};

export function LinkedInPostList({
  posts,
  onPostUpdated,
}: {
  posts: LinkedInPost[];
  onPostUpdated: (post: LinkedInPost) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorByPost, setErrorByPost] = useState<Record<string, string>>({});

  function startEdit(post: LinkedInPost) {
    setEditingId(post.id);
    setDraft(post.commentary);
    setErrorByPost((prev) => ({ ...prev, [post.id]: '' }));
  }

  async function handleSave(post: LinkedInPost) {
    setSaving(true);
    try {
      const { post: updated } = await editLinkedInPost(post.id, draft.trim());
      onPostUpdated(updated);
      setEditingId(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? (err.errorCode ? ERROR_MESSAGES[err.errorCode] ?? err.message : err.message) : 'Failed to save the edit.';
      setErrorByPost((prev) => ({ ...prev, [post.id]: message }));
    } finally {
      setSaving(false);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-10 text-center backdrop-blur">
        <p className="text-sm text-ink-soft">No posts published through CrossPost AI yet.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur">
      <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="divide-y divide-border">
        {posts.map((post) => {
          const isEditing = editingId === post.id;
          const postError = errorByPost[post.id];

          return (
            <motion.li key={post.id} variants={fadeUp} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-faint">
                    {post.visibility === 'PUBLIC' ? 'Public' : 'Connections only'} ·{' '}
                    {new Date(post.createdAt).toLocaleString()}
                  </p>

                  <AnimatePresence mode="wait" initial={false}>
                    {isEditing ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-2"
                      >
                        <textarea
                          value={draft}
                          maxLength={3000}
                          rows={4}
                          onChange={(e) => setDraft(e.target.value)}
                          disabled={saving}
                          className="w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50"
                        />
                      </motion.div>
                    ) : (
                      <motion.p
                        key="viewing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 whitespace-pre-wrap text-sm text-ink"
                      >
                        {post.commentary}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {postError && <p className="mt-2 text-xs text-rose-400">{postError}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSave(post)}
                        disabled={saving || draft.trim().length === 0}
                        className="rounded-md bg-[#0A66C2] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(post)}
                      className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-violet/40 hover:text-ink"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
