'use client';

import { motion } from 'motion/react';
import type { InstagramMedia } from '@/lib/types';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';

export function InstagramMediaList({ items }: { items: InstagramMedia[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">No media on this account yet.</p>;
  }

  return (
    <motion.ul {...revealOnScroll} variants={staggerContainer} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((media) => (
        <motion.li
          key={media.id}
          variants={fadeUp}
          className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur transition-colors hover:border-[#D62976]/40"
        >
          <a href={media.permalink ?? '#'} target="_blank" rel="noreferrer" className="group relative block aspect-square w-full overflow-hidden bg-black">
            {media.thumbnailUrl || media.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.thumbnailUrl ?? media.mediaUrl} alt="" className="h-full w-full object-cover transition duration-slow ease-smooth group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-ink-faint">No preview</div>
            )}
            {media.mediaType && (
              <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                {media.mediaType.replace(/_/g, ' ')}
              </span>
            )}
          </a>
          <div className="p-3">
            <p className="line-clamp-2 text-xs text-ink-soft">{media.caption || '(no caption)'}</p>
            {media.timestamp && <p className="mt-1 text-[10px] text-ink-faint">{new Date(media.timestamp).toLocaleDateString()}</p>}
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
