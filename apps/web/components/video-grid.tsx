'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { VideoPlayerModal } from './video-player-modal';
import type { ExternalPost } from '@/lib/types';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';

function formatDuration(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatViewCount(count: number | undefined): string | null {
  if (count === undefined) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} view${count === 1 ? '' : 's'}`;
}

const PRIVACY_STYLES: Record<ExternalPost['privacyStatus'], string> = {
  public: 'bg-emerald-500/15 text-emerald-300',
  unlisted: 'bg-amber-500/15 text-amber-300',
  private: 'bg-white/10 text-ink-soft',
};

export function VideoGrid({
  videos,
  publishedViaAppIds,
}: {
  videos: ExternalPost[];
  /** platformPostIds that CrossPost AI itself published, for the small attribution badge. */
  publishedViaAppIds: Set<string>;
}) {
  const [playing, setPlaying] = useState<ExternalPost | null>(null);

  // A private video simply won't play in a third-party embed, regardless of what the
  // "embeddable" flag says — YouTube restricts private playback to the owner's own
  // surfaces. Treat both conditions the same way: link out instead of embedding.
  const canEmbed = (video: ExternalPost) => video.privacyStatus !== 'private' && video.isEmbeddable;

  return (
    <>
      <motion.ul
        {...revealOnScroll}
        variants={staggerContainer}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {videos.map((video) => {
          const embeddable = canEmbed(video);
          const duration = formatDuration(video.durationSeconds);
          const views = formatViewCount(video.viewCount);
          const watchUrl = `https://www.youtube.com/watch?v=${video.platformPostId}`;

          return (
            <motion.li
              key={video.platformPostId}
              variants={fadeUp}
              className="overflow-hidden rounded-xl border border-border bg-surface/60 backdrop-blur transition-colors hover:border-brand-violet/40"
            >
              <button
                type="button"
                onClick={() => (embeddable ? setPlaying(video) : window.open(watchUrl, '_blank', 'noreferrer'))}
                className="group relative block aspect-video w-full overflow-hidden bg-black"
              >
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-slow ease-smooth group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-faint">No thumbnail</div>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                  <span className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-white/90 opacity-0 shadow transition duration-base ease-spring group-hover:scale-100 group-hover:opacity-100">
                    {embeddable ? (
                      <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 text-slate-900" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7M21 12H3" />
                      </svg>
                    )}
                  </span>
                </div>

                {duration && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                    {duration}
                  </span>
                )}
              </button>

              <div className="p-4">
                <p className="line-clamp-2 text-sm font-medium text-ink">{video.title}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIVACY_STYLES[video.privacyStatus]}`}
                  >
                    {video.privacyStatus}
                  </span>
                  {publishedViaAppIds.has(video.platformPostId) && (
                    <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-medium text-white">
                      via CrossPost AI
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-ink-faint">
                  {[views, new Date(video.publishedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                </p>

                {!embeddable && (
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-red-400 hover:underline"
                  >
                    {video.privacyStatus === 'private' ? 'Private — open on YouTube →' : 'Open on YouTube →'}
                  </a>
                )}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>

      <AnimatePresence>
        {playing && (
          <VideoPlayerModal
            videoId={playing.platformPostId}
            title={playing.title}
            onClose={() => setPlaying(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
