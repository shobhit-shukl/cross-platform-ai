'use client';

import { motion } from 'motion/react';
import { fadeUp, hoverLift, revealOnScroll, staggerContainer } from '@/lib/motion';

const FEATURES = [
  {
    title: 'AI-written metadata',
    body: 'Generate titles, descriptions, hashtags and captions tuned to each platform — one video, the right framing everywhere.',
    icon: (
      <path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3zM19 14l.95 2.4L22.35 17.35l-2.4.95L19 20.7l-.95-2.4L15.65 17.35l2.4-.95L19 14z" />
    ),
  },
  {
    title: 'Publish everywhere at once',
    body: 'Upload a video a single time and push it to every connected account in one action, instead of repeating the same upload on each site.',
    icon: <path d="M12 3v10m0-10L8 7m4-4l4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />,
  },
  {
    title: 'Automated scheduling',
    body: 'Queue posts ahead of time and let them go out on their own — per-platform timing, no manual reminders.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  },
  {
    title: 'Official APIs only',
    body: 'Every connection uses the platform’s own OAuth flow. No scraping, no browser automation, and we never ask for your password.',
    icon: (
      <>
        <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
        <path d="M9.5 12.2l1.8 1.8 3.5-3.6" />
      </>
    ),
  },
  {
    title: 'Encrypted credentials',
    body: 'Access and refresh tokens are encrypted at rest with AES-256-GCM and stay on the server — they are never sent to your browser.',
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 118 0v3" />
      </>
    ),
  },
  {
    title: 'Publishing history',
    body: 'Track every upload from queued to published, with the resulting post ID and a direct link — plus a clear reason whenever something fails.',
    icon: (
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...revealOnScroll} variants={fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">
            Built to remove the repetitive part
          </h2>
          <p className="mt-4 text-ink-soft">
            The tedious work of reformatting and re-uploading the same content for every
            audience, handled for you.
          </p>
        </motion.div>

        <motion.div
          {...revealOnScroll}
          variants={staggerContainer}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              whileHover={hoverLift}
              className="rounded-xl border border-border bg-surface/60 p-6 backdrop-blur transition-colors hover:border-brand-cyan/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-[0_0_18px_-4px_rgba(139,92,246,0.6)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {feature.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
