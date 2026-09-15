'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ApiError, publishVideoToInstagram } from '@/lib/api';
import { scaleIn, smooth, spring } from '@/lib/motion';

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No Instagram account connected. Connect Instagram from the dashboard first.',
  reauth_required: 'Reconnect Instagram from the dashboard — permission is missing or expired.',
  insufficient_scope: 'Reconnect Instagram from the dashboard — permission is missing or expired.',
  quota_exceeded: 'Instagram rate limit reached. Please try again shortly.',
  invalid_video: 'Instagram Reels only accept MP4 or MOV video files.',
  network_error: 'A network error interrupted the upload. Please try again.',
};

type Stage = 'idle' | 'uploading' | 'processing' | 'published' | 'failed';

export function InstagramPublishForm({ onPublished }: { onPublished?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [dragging, setDragging] = useState(false);

  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [platformPostId, setPlatformPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortUploadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(selected: File | null) {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!selected) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (selected.size > MAX_VIDEO_SIZE_BYTES) {
      setError(`Video exceeds the ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB limit`);
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
    setCaption('');
    setStage('idle');
    setProgress(0);
    setPlatformPostId(null);
    setError(null);
  }

  async function handlePublish() {
    if (!file) return;
    setError(null);
    setStage('uploading');
    setProgress(0);

    const { promise, abort } = publishVideoToInstagram({ video: file, caption, onProgress: setProgress });
    abortUploadRef.current = abort;

    try {
      setStage('processing');
      const { post } = await promise;
      abortUploadRef.current = null;
      setPlatformPostId(post.platformPostId);
      setStage('published');
      onPublished?.();
    } catch (err) {
      abortUploadRef.current = null;
      if (err instanceof ApiError && err.message === 'Upload cancelled') {
        setStage('idle');
        return;
      }
      setStage('failed');
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Failed to publish to Instagram.');
      }
    }
  }

  function handleCancel() {
    abortUploadRef.current?.();
    abortUploadRef.current = null;
    setStage('idle');
  }

  const isBusy = stage === 'uploading' || stage === 'processing';
  const canPublish = !!file && !isBusy;
  const inputClass =
    'mt-1 w-full rounded-md border border-border-strong bg-white/[0.03] px-3 py-2 text-sm text-ink transition focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30 disabled:opacity-50';

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
      <h2 className="text-base font-semibold text-ink">Upload a Reel</h2>

      <AnimatePresence mode="wait">
        {stage === 'published' && platformPostId ? (
          <PublishedSuccess key="success" onCreateAnother={resetForm} />
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-soft">Select Video (MP4 or MOV)</label>
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
                  dragging ? 'scale-[1.01] border-brand-violet bg-brand-violet/10' : 'border-border-strong bg-white/[0.02]'
                }`}
              >
                <input
                  id="ig-video"
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  disabled={isBusy}
                  className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-brand-gradient file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:brightness-110 disabled:opacity-50"
                />
                <p className="mt-2 text-xs text-ink-faint">or drag a video file here</p>
              </div>
            </div>

            <AnimatePresence>
              {previewUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={previewUrl} controls className="max-h-72 w-full rounded-md bg-black" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="ig-caption" className="block text-sm font-medium text-ink-soft">
                  Caption
                </label>
                <span className="text-xs text-ink-faint">{caption.length}/2200</span>
              </div>
              <textarea
                id="ig-caption"
                value={caption}
                maxLength={2200}
                rows={4}
                placeholder="Write a caption…"
                onChange={(e) => setCaption(e.target.value)}
                disabled={isBusy}
                className={inputClass}
              />
            </div>

            <AnimatePresence>
              {stage === 'uploading' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FEDA75] via-[#D62976] to-[#4F5BD5]"
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
                Publishing to Instagram… Reels can take a minute or two to process before they go live.
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
                  {error ?? 'Something went wrong while publishing.'}
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
                className="rounded-md bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(214,41,118,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish to Instagram
              </motion.button>
              {isBusy && (
                <button type="button" onClick={handleCancel} className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink active:scale-95">
                  Cancel
                </button>
              )}
              {stage === 'failed' && (
                <button type="button" onClick={resetForm} className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink active:scale-95">
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

function PublishedSuccess({ onCreateAnother }: { onCreateAnother: () => void }) {
  return (
    <motion.div key="success" initial="hidden" animate="visible" variants={scaleIn} className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-5 py-6 text-center">
      <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.1 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
      <p className="mt-3 text-base font-semibold text-emerald-300">Published Successfully</p>
      <p className="mt-1 text-sm text-emerald-200/80">Your Reel is now live on Instagram.</p>
      <motion.button
        type="button"
        onClick={onCreateAnother}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        className="mt-4 block w-full rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)] transition hover:brightness-110 sm:inline-block sm:w-auto"
      >
        Publish another reel
      </motion.button>
    </motion.div>
  );
}
