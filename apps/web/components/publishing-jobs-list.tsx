'use client';

import { motion } from 'motion/react';
import type { PublishingJob, PublishStatus } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

const STATUS_STYLES: Record<PublishStatus, string> = {
  QUEUED: 'bg-white/10 text-ink-soft',
  PROCESSING: 'bg-amber-500/15 text-amber-300',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-300',
  FAILED: 'bg-rose-500/15 text-rose-300',
};

export function PublishingJobsList({ jobs }: { jobs: PublishingJob[] }) {
  if (jobs.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
        <h2 className="text-base font-semibold text-ink">Recent Posts</h2>
        <p className="mt-2 text-sm text-ink-soft">No posts published yet.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-ink">Recent Posts</h2>
      </div>
      <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="divide-y divide-border">
        {jobs.map((job) => (
          <motion.li
            key={job.id}
            variants={fadeUp}
            className="flex items-center justify-between gap-4 px-6 py-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{job.title}</p>
              <p className="text-xs text-ink-faint">
                {job.platform} · {job.privacyStatus} · {new Date(job.createdAt).toLocaleString()}
              </p>
              {job.status === 'FAILED' && job.error && (
                <p className="mt-0.5 text-xs text-rose-400">{job.error}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                {job.status}
              </span>
              {job.status === 'PUBLISHED' && job.platformPostId && (
                <a
                  href={`https://www.youtube.com/watch?v=${job.platformPostId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-red-400 hover:underline"
                >
                  View →
                </a>
              )}
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
