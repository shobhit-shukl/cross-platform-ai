'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  cancelPublishingJob,
  generateVideoMetadata,
  getPublishingJob,
  publishVideoToYouTube,
} from '@/lib/api';
import type { PrivacyStatus, PublishingJob } from '@/lib/types';
import { scaleIn, smooth, spring } from '@/lib/motion';

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

const AI_ERROR_MESSAGES: Record<string, string> = {
  not_configured: 'AI generation is not set up on this server yet.',
  quota_exceeded: 'AI rate limit reached. Wait a moment and try again.',
  model_unavailable: 'The configured AI model is unavailable. An admin needs to update it.',
  blocked: 'The AI declined that description. Try rephrasing it.',
  empty_response: 'The AI returned nothing. Please try again.',
  invalid_response: 'The AI returned an unexpected format. Please try again.',
  network_error: 'Could not reach the AI service. Please try again.',
};

type Stage = 'idle' | 'uploading' | 'processing' | 'published' | 'failed';

export function PublishForm({ onJobSettled }: { onJobSettled?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [dragging, setDragging] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  function handleFile(selected: File | null) {
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
    setAiPrompt('');
    setAiError(null);
  }

  /**
   * Fills the title/description fields rather than publishing directly — the generated
   * text is a starting point the user reviews and edits, not something posted to their
   * channel unseen.
   */
  async function handleGenerate() {
    if (aiPrompt.trim().length < 3) return;
    setAiError(null);
    setGenerating(true);
    try {
      const { metadata } = await generateVideoMetadata(aiPrompt.trim());
      setTitle(metadata.title);
      setDescription(metadata.description);
    } catch (err) {
      if (err instanceof ApiError) {
        setAiError(err.errorCode ? (AI_ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setAiError('Failed to generate metadata. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
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
    if (job && stage === 'processing') {
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
  const inputClass =
    'mt-1 w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
      <h2 className="text-base font-semibold text-ink">Create Post</h2>

      <AnimatePresence mode="wait">
        {stage === 'published' && job ? (
          <PublishedSuccess key="success" job={job} onCreateAnother={resetForm} />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-ink-soft">Select Video</label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isBusy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!isBusy) handleFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`mt-1 rounded-lg border-2 border-dashed p-6 text-center transition ${
                  dragging
                    ? 'scale-[1.01] border-brand-violet bg-brand-violet/10'
                    : 'border-border-strong bg-white/[0.02]'
                }`}
              >
                <input
                  id="video"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  disabled={isBusy}
                  className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-brand-gradient file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:brightness-110 disabled:opacity-50"
                />
                <p className="mt-2 text-xs text-ink-faint">or drag a video file here</p>
              </div>
              {validationError && <p className="mt-1 text-sm text-rose-400">{validationError}</p>}
            </div>

            <AnimatePresence>
              {previewUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mb-1 text-sm font-medium text-ink-soft">Video Preview</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={previewUrl} controls className="max-h-72 w-full rounded-md bg-black" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-semibold text-ink">YouTube</p>

              <div className="mb-5 rounded-lg border border-brand-violet/25 bg-brand-gradient-soft p-4">
                <label htmlFor="ai-prompt" className="block text-sm font-medium text-ink">
                  ✨ Generate with AI
                </label>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Describe your video in a sentence — AI drafts the title and description for you to edit.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="ai-prompt"
                    type="text"
                    value={aiPrompt}
                    maxLength={1000}
                    placeholder="e.g. 20s clip of my cat knocking a plant off the windowsill"
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // This input sits inside the publish <form>; without this an
                        // Enter press would submit the form instead of generating.
                        e.preventDefault();
                        if (!generating && !isBusy && aiPrompt.trim().length >= 3) handleGenerate();
                      }
                    }}
                    disabled={generating || isBusy}
                    className="flex-1 rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50"
                  />
                  <motion.button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || isBusy || aiPrompt.trim().length < 3}
                    whileTap={{ scale: 0.97 }}
                    transition={spring}
                    className="shrink-0 rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? 'Generating…' : 'Generate'}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {aiError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 overflow-hidden text-xs text-rose-400"
                    >
                      {aiError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-ink-soft">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isBusy}
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
                    rows={4}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isBusy}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="privacy" className="block text-sm font-medium text-ink-soft">
                    Privacy
                  </label>
                  <select
                    id="privacy"
                    value={privacyStatus}
                    onChange={(e) => setPrivacyStatus(e.target.value as PrivacyStatus)}
                    disabled={isBusy}
                    className={inputClass}
                  >
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {stage === 'uploading' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="relative h-full overflow-hidden rounded-full bg-brand-gradient"
                      animate={{ width: `${progress}%` }}
                      transition={smooth}
                    >
                      <div className="motion-safe:animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    </motion.div>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">Uploading… {progress}%</p>
                </motion.div>
              )}
            </AnimatePresence>

            {stage === 'processing' && (
              <p className="text-sm text-ink-soft">
                Publishing to YouTube… this can take a moment for larger files.
              </p>
            )}

            <AnimatePresence>
              {stage === 'failed' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                >
                  {job?.errorCode && ERROR_MESSAGES[job.errorCode]
                    ? ERROR_MESSAGES[job.errorCode]
                    : job?.error ?? validationError ?? 'Something went wrong while publishing.'}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish}
                whileTap={canPublish ? { scale: 0.97 } : undefined}
                transition={spring}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(220,38,38,0.6)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish to YouTube
              </motion.button>
              {isBusy && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink active:scale-95"
                >
                  Cancel
                </button>
              )}
              {stage === 'failed' && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink active:scale-95"
                >
                  Try again
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function PublishedSuccess({ job, onCreateAnother }: { job: PublishingJob; onCreateAnother: () => void }) {
  const watchUrl = job.platformPostId ? `https://www.youtube.com/watch?v=${job.platformPostId}` : null;

  return (
    <motion.div
      key="success"
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-5 py-6 text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
      <p className="mt-3 text-base font-semibold text-emerald-300">Published Successfully</p>
      <p className="mt-1 text-sm text-emerald-200/80">
        &ldquo;{job.title}&rdquo; is now on YouTube ({job.privacyStatus}).
      </p>
      {watchUrl && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-emerald-300 underline"
        >
          View on YouTube →
        </a>
      )}
      <p className="mt-2 text-xs text-emerald-200/70">
        Video ID: <code>{job.platformPostId}</code>
      </p>
      {job.privacyStatus === 'public' && (
        <p className="mt-3 text-xs text-emerald-200/60">
          Note: if this project hasn&apos;t completed YouTube&apos;s API audit, Google may keep the video
          private regardless of the privacy setting sent.
        </p>
      )}
      <motion.button
        type="button"
        onClick={onCreateAnother}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className="mt-4 rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110"
      >
        Create another post
      </motion.button>
    </motion.div>
  );
}
