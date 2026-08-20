'use client';

import { motion } from 'motion/react';
import type { ComponentType, SVGProps } from 'react';
import {
  CalendarIcon,
  DriveIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SnapchatIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from './platform-icons';
import { fadeUp, hoverLift, revealOnScroll, staggerContainer } from '@/lib/motion';

interface PlatformEntry {
  name: string;
  status: 'live' | 'soon';
  /** Applied via currentColor — omitted for icons that ship their own brand colours (Drive, Calendar). */
  color?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Single source of truth for what the landing page claims. Flipping a platform to
 * 'live' when its integration ships is a one-word edit.
 */
const PLATFORMS: PlatformEntry[] = [
  { name: 'YouTube', status: 'live', color: 'text-red-500', Icon: YouTubeIcon },
  { name: 'Google Drive', status: 'live', Icon: DriveIcon },
  { name: 'Google Calendar', status: 'live', Icon: CalendarIcon },
  { name: 'Instagram', status: 'soon', color: 'text-pink-400', Icon: InstagramIcon },
  { name: 'LinkedIn', status: 'soon', color: 'text-sky-400', Icon: LinkedInIcon },
  { name: 'TikTok', status: 'soon', color: 'text-white', Icon: TikTokIcon },
  { name: 'Snapchat', status: 'soon', color: 'text-yellow-400', Icon: SnapchatIcon },
  { name: 'X', status: 'soon', color: 'text-white', Icon: XIcon },
  { name: 'Facebook', status: 'soon', color: 'text-blue-400', Icon: FacebookIcon },
];

export function PlatformGrid() {
  return (
    <section id="platforms" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...revealOnScroll} variants={fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">Connect everything your workflow needs</h2>
          <p className="mt-4 text-ink-soft">
            Each account connects once through its official OAuth flow. YouTube, Google
            Drive and Google Calendar are live today — the rest are on the way.
          </p>
        </motion.div>

        <motion.ul
          {...revealOnScroll}
          variants={staggerContainer}
          className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {PLATFORMS.map(({ name, status, color, Icon }) => {
            const isLive = status === 'live';
            return (
              <motion.li
                key={name}
                variants={fadeUp}
                whileHover={isLive ? hoverLift : undefined}
                className={`flex flex-col items-center gap-3 rounded-xl border bg-surface/60 p-6 text-center backdrop-blur transition-colors ${
                  isLive
                    ? 'border-border-strong hover:border-brand-violet/50 hover:shadow-[0_0_30px_-10px_rgba(139,92,246,0.6)]'
                    : 'border-border opacity-50'
                }`}
              >
                <Icon className={`h-9 w-9 ${color ?? ''}`} />
                <span className="text-sm font-semibold text-ink">{name}</span>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.7)]" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-ink-faint">
                    Coming soon
                  </span>
                )}
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
