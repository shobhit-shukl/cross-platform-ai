'use client';

import type { PublishingJob, PublishStatus } from '@/lib/types';

const STATUS_STYLES: Record<PublishStatus, string> = {
  QUEUED: 'bg-slate-100 text-slate-700',
  PROCESSING: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
};

export function PublishingJobsList({ jobs }: { jobs: PublishingJob[] }) {
  if (jobs.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Recent Posts</h2>
        <p className="mt-2 text-sm text-slate-500">No posts published yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Recent Posts</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{job.title}</p>
              <p className="text-xs text-slate-500">
                {job.platform} · {job.privacyStatus} · {new Date(job.createdAt).toLocaleString()}
              </p>
              {job.status === 'FAILED' && job.error && (
                <p className="mt-0.5 text-xs text-red-600">{job.error}</p>
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
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  View →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
