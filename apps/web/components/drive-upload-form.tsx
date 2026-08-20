'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, uploadFileToDrive } from '@/lib/api';
import { smooth, spring } from '@/lib/motion';

const MAX_DRIVE_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  no_account_connected: 'No Google Drive account connected. Connect it from the dashboard first.',
  reauth_required: 'Reconnect Google Drive from the dashboard — permission is missing or expired.',
  quota_exceeded: 'Google Drive storage quota reached.',
  network_error: 'A network error interrupted the upload. Please try again.',
};

export function DriveUploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);

    if (file.size > MAX_DRIVE_FILE_SIZE_BYTES) {
      setError(`File exceeds the ${MAX_DRIVE_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`);
      return;
    }

    setUploading(true);
    try {
      await uploadFileToDrive(file);
      onUploaded?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorCode ? (ERROR_MESSAGES[err.errorCode] ?? err.message) : err.message);
      } else {
        setError('Failed to upload the file.');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur">
      <h2 className="text-base font-semibold text-ink">Upload to Google Drive</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`mt-4 rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragging ? 'scale-[1.01] border-brand-violet bg-brand-violet/10' : 'border-border-strong bg-white/[0.02]'
        }`}
      >
        <input
          id="drive-file"
          type="file"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
          className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-brand-gradient file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:brightness-110 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-ink-faint">or drag any file here</p>
      </div>

      <AnimatePresence>
        {uploading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            className="mt-3 text-sm text-ink-soft"
          >
            Uploading…
          </motion.p>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="mt-3 overflow-hidden rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
