'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ApiError, deleteDriveFile } from '@/lib/api';
import type { DriveFile } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';

function formatFileSize(bytes: number | undefined): string | null {
  if (bytes === undefined) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function DriveFileList({
  files,
  onFileDeleted,
}: {
  files: DriveFile[];
  onFileDeleted: (fileId: string) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(file: DriveFile) {
    setError(null);
    setDeletingId(file.fileId);
    try {
      await deleteDriveFile(file.fileId);
      onFileDeleted(file.fileId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.errorCode === 'reauth_required'
            ? 'Reconnect Google Drive from the dashboard to manage files.'
            : err.message
          : 'Failed to delete this file.',
      );
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-10 text-center backdrop-blur">
        <p className="text-sm text-ink-soft">No files uploaded through CrossPost AI yet.</p>
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
        {files.map((file) => {
          const size = formatFileSize(file.sizeBytes);
          const modified = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : null;
          const isConfirming = confirmingId === file.fileId;
          const isDeleting = deletingId === file.fileId;

          return (
            <motion.li key={file.fileId} variants={fadeUp} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {file.iconLink ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.iconLink} alt="" className="h-9 w-9 shrink-0 rounded-md object-contain" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <FileIcon />
                  </div>
                )}
                <div className="min-w-0">
                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium text-ink hover:underline"
                    >
                      {file.name}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                  )}
                  <p className="text-xs text-ink-faint">
                    {[size, modified].filter(Boolean).join(' · ') || file.mimeType}
                  </p>
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
                        onClick={() => handleDelete(file)}
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
                      onClick={() => setConfirmingId(file.fileId)}
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

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </svg>
  );
}
