'use client';

import { motion } from 'motion/react';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { AuthCta } from './auth-cta';
import {
  CalendarIcon,
  DriveIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SnapchatIcon,
  TikTokIcon,
} from './platform-icons';
import { fadeUp, staggerContainer } from '@/lib/motion';

// Small orbiting brand chips around the headline — the "moving images" the hero needs.
// Purely decorative, so they're hidden on small screens rather than cramping the layout.
// Drive/Calendar omit `color` — those icons carry their own brand colours already.
const FLOATING_ICONS = [
  { Icon: DriveIcon, className: 'left-[4%] top-[16%] motion-safe:animate-float-slow', color: '' },
  { Icon: CalendarIcon, className: 'right-[6%] top-[14%] motion-safe:animate-float-reverse', color: '' },
  { Icon: InstagramIcon, className: 'left-[10%] top-[46%] motion-safe:animate-float-medium', color: 'text-pink-400' },
  { Icon: LinkedInIcon, className: 'right-[10%] top-[44%] motion-safe:animate-float-slow', color: 'text-sky-400' },
  { Icon: TikTokIcon, className: 'left-[14%] bottom-[12%] motion-safe:animate-float-reverse', color: 'text-white' },
  { Icon: SnapchatIcon, className: 'right-[16%] bottom-[16%] motion-safe:animate-float-medium', color: 'text-yellow-400' },
  { Icon: FacebookIcon, className: 'left-[2%] bottom-[34%] motion-safe:animate-float-slow', color: 'text-blue-400' },
];

export function Hero() {
  return (
    <section className="bg-noise relative overflow-hidden">
      <AnimatedBackground intensity="high" />

      {/* Graph-paper grid, masked so it dissolves before it reaches the content below. */}
      <div aria-hidden className="bg-grid-pattern bg-grid-fade pointer-events-none absolute inset-0" />

      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {FLOATING_ICONS.map(({ Icon, className, color }, i) => (
          <div
            key={i}
            className={`absolute flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-surface/60 backdrop-blur-md ${className}`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        ))}
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28"
      >
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/80 px-3 py-1 text-xs font-medium text-ink-soft backdrop-blur"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="motion-safe:animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
          </span>
          YouTube, Google Drive &amp; Calendar are live
        </motion.span>

        <motion.h1
          variants={fadeUp}
          className="mt-6 text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl"
        >
          Publish once.{' '}
          {/* bg-[length:200%_auto] gives the gradient room to travel, so the animation
              shifts hue across the text instead of sitting still. */}
          <span className="motion-safe:animate-gradient-shift bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-[length:200%_auto] bg-clip-text text-transparent">
            Everywhere your audience is.
          </span>
        </motion.h1>

        <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          CrossPost AI connects your social accounts through their official APIs, then
          takes one video and publishes it across every platform — with AI writing the
          titles, descriptions and captions for each one.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex justify-center">
          <AuthCta variant="hero" />
        </motion.div>

        <motion.p variants={fadeUp} className="mt-5 text-xs text-ink-faint">
          Free to start · Official OAuth · We never ask for your platform password
        </motion.p>
      </motion.div>
    </section>
  );
}
