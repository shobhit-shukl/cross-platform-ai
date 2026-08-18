'use client';

import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { scaleIn, smooth } from '@/lib/motion';

interface VideoPlayerModalProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

/**
 * A lightbox player. Renders on top of the video grid so a user can watch several
 * videos in a row without losing their scroll position. Uses youtube-nocookie.com,
 * which defers setting tracking cookies until the video is actually played.
 *
 * The parent renders this inside <AnimatePresence>, which is what makes the exit
 * animation possible at all — without it the element would just vanish on unmount.
 */
export function VideoPlayerModal({ videoId, title, onClose }: VideoPlayerModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={smooth}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden" className="w-full max-w-4xl">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="shrink-0 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl shadow-brand-violet/20">
          <iframe
            key={videoId}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
