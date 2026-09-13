'use client';

import { motion } from 'motion/react';
import type { FacebookVideo } from '@/lib/types';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';

function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FacebookVideoList({ videos }: { videos: FacebookVideo[] }) {
  if (videos.length === 0) {
    return <p className="text-sm text-ink-soft">No videos on this Page yet.</p>;
  }

  return (
    <motion.ul {...revealOnScroll} variants={staggerContainer} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => {
        const duration = formatDuration(video.lengthSeconds);
        return (
          <motion.li
            key={video.id}
            variants={fadeUp}
            className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur transition-colors hover:border-[#1877F2]/40"
          >
            <a
              href={video.permalinkUrl ?? `https://www.facebook.com/watch/?v=${video.id}`}
              target="_blank"
              rel="noreferrer"
              className="group relative block aspect-video w-full overflow-hidden bg-black"
            >
              {video.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.pictureUrl} alt="" className="h-full w-full object-cover transition duration-slow ease-smooth group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-faint">No thumbnail</div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition duration-base ease-spring group-hover:scale-100 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M21 12H3" />
                  </svg>
                </span>
              </div>
              {duration && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">{duration}</span>}
            </a>
            <div className="p-4">
              <p className="line-clamp-2 text-sm font-medium text-ink">{video.description || '(no caption)'}</p>
              {video.createdTime && <p className="mt-2 text-xs text-ink-faint">{new Date(video.createdTime).toLocaleDateString()}</p>}
            </div>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
