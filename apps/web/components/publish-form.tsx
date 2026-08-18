'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  cancelPublishingJob,
  getPublishingJob,
  publishVideoToYouTube,
} from '@/lib/api';
import type { PrivacyStatus, PublishingJob } from '@/lib/types';

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
const POLL_INTERVAL_MS = 2000;

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No YouTube account connected. Connect YouTube from the dashboard first.',
  reauth_required: 'Reconnect YouTube from the dashboard — upload permission is missing or expired.',
  insufficient_scope: 'Reconnect YouTube from the dashboard — upload permission is missing or expired.',
  quota_exceeded: 'Daily YouTube upload quota reached. Please try again tomorrow.',
  cancelled: 'Upload cancelled.',
  interrupted: 'The server restarted during this upload. Please try again.',
  network_error: 'A network error interrupted the upload. Please try again.',
};

type Stage = 'idle' | 'uploading' | 'processing' | 'published' | 'failed';

export function PublishForm({ onJobSettled }: { onJobSettled?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');

  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState<PublishingJob | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const abortUploadRef = useRef<(() => void) | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setValidationError(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!selected) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    if (selected.size > MAX_VIDEO_SIZE_BYTES) {
      setValidationError(`Video exceeds the ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB limit`);
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function resetForm() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setPrivacyStatus('private');
    setStage('idle');
    setProgress(0);
    setJob(null);
    setValidationError(null);
  }

  function pollJob(jobId: string) {
    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const { job: updated } = await getPublishingJob(jobId);
        setJob(updated);

        if (updated.status === 'PUBLISHED') {
          setStage('published');
          onJobSettled?.();
        } else if (updated.status === 'FAILED') {
          setStage('failed');
          onJobSettled?.();
        } else {
          setStage('processing');
          pollJob(jobId);
        }
      } catch {
        // Transient polling failure — keep trying, the job is still processing server-side.
        pollJob(jobId);
      }
    }, POLL_INTERVAL_MS);
  }

  async function handlePublish() {
    if (!file) return;
    setValidationError(null);
    setStage('uploading');
    setProgress(0);

    const { promise, abort } = publishVideoToYouTube({
      video: file,
      title,
      description,
      privacyStatus,
      onProgress: setProgress,
    });
    abortUploadRef.current = abort;

    try {
      const { job: created } = await promise;
      abortUploadRef.current = null;
      setJob(created);
      setStage('processing');
      pollJob(created.id);
    } catch (err) {
      abortUploadRef.current = null;
      if (err instanceof ApiError && err.message === 'Upload cancelled') {
        setStage('idle');
        return;
      }
      setStage('failed');
      setValidationError(err instanceof ApiError ? err.message : 'Failed to start the upload.');
    }
  }

  async function handleCancel() {
    if (abortUploadRef.current) {
      abortUploadRef.current();
      abortUploadRef.current = null;
      return;
    }
    if (job && (stage === 'processing')) {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      try {
        const { job: cancelled } = await cancelPublishingJob(job.id);
        setJob(cancelled);
        setStage('failed');
        onJobSettled?.();
      } catch {
        // best-effort
      }
    }
  }

  const isBusy = stage === 'uploading' || stage === 'processing';
  const canPublish = !!file && title.trim().length > 0 && !isBusy;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Create Post</h2>

      {stage === 'published' && job ? (
        <PublishedSuccess job={job} onCreateAnother={resetForm} />
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">Select Video</label>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi"
              onChange={handleFileChange}
              disabled={isBusy}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-50"
            />
            {validationError && <p className="mt-1 text-sm text-red-600">{validationError}</p>}
          </div>

          {previewUrl && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Video Preview</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={previewUrl} controls className="max-h-72 w-full rounded-md bg-black" />
            </div>
          )}

          <div className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">YouTube</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isBusy}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  maxLength={5000}
                  rows={4}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isBusy}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="privacy" className="block text-sm font-medium text-slate-700">
                  Privacy
                </label>
                <select
                  id="privacy"
                  value={privacyStatus}
                  onChange={(e) => setPrivacyStatus(e.target.value as PrivacyStatus)}
                  disabled={isBusy}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          </div>

          {stage === 'uploading' && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">Uploading… {progress}%</p>
            </div>
          )}

          {stage === 'processing' && (
            <p className="text-sm text-slate-500">Publishing to YouTube… this can take a moment for larger files.</p>
          )}

          {stage === 'failed' && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {job?.errorCode && ERROR_MESSAGES[job.errorCode]
                ? ERROR_MESSAGES[job.errorCode]
                : job?.error ?? validationError ?? 'Something went wrong while publishing.'}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish to YouTube
            </button>
            {isBusy && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            {stage === 'failed' && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PublishedSuccess({ job, onCreateAnother }: { job: PublishingJob; onCreateAnother: () => void }) {
  const watchUrl = job.platformPostId ? `https://www.youtube.com/watch?v=${job.platformPostId}` : null;

  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
      <p className="text-base font-semibold text-emerald-800">Published Successfully ✓</p>
      <p className="mt-1 text-sm text-emerald-700">
        &ldquo;{job.title}&rdquo; is now on YouTube ({job.privacyStatus}).
      </p>
      {watchUrl && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-emerald-800 underline"
        >
          View on YouTube →
        </a>
      )}
      <p className="mt-2 text-xs text-emerald-700">
        Video ID: <code>{job.platformPostId}</code>
      </p>
      {job.privacyStatus === 'public' && (
        <p className="mt-3 text-xs text-emerald-600">
          Note: if this project hasn&apos;t completed YouTube&apos;s API audit, Google may keep the video
          private regardless of the privacy setting sent.
        </p>
      )}
      <button
        type="button"
        onClick={onCreateAnother}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Create another post
      </button>
    </div>
  );
}
