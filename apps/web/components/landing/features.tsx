'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';

interface Feature {
  title: string;
  body: string;
  icon: ReactNode;
  /** Bento span. Varying these is what makes the grid a bento rather than a card wall. */
  span: string;
  glow?: string;
  accent: string;
}

const FEATURES: Feature[] = [
  {
    title: 'AI-written metadata',
    body: 'Describe your video in a sentence and get a title, description and hashtags tuned to each platform — generated, then yours to edit before anything publishes.',
    span: 'md:col-span-2 md:row-span-2',
    glow: 'rgba(139,92,246,0.18)',
    accent: 'from-violet-500 to-fuchsia-500',
    icon: (
      <path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3zM19 14l.95 2.4L22.35 17.35l-2.4.95L19 20.7l-.95-2.4L15.65 17.35l2.4-.95L19 14z" />
    ),
  },
  {
    title: 'Publish everywhere at once',
    body: 'Upload once, push to every connected account in a single action.',
    span: 'md:col-span-2',
    glow: 'rgba(34,211,238,0.16)',
    accent: 'from-cyan-400 to-sky-500',
    icon: <path d="M12 3v10m0-10L8 7m4-4l4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />,
  },
  {
    title: 'Official APIs only',
    body: 'Every connection uses the platform’s own OAuth flow. No scraping, no browser automation, and we never ask for your password.',
    span: 'md:col-span-2 md:row-span-2',
    glow: 'rgba(52,211,153,0.16)',
    accent: 'from-emerald-400 to-teal-500',
    icon: (
      <>
        <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
        <path d="M9.5 12.2l1.8 1.8 3.5-3.6" />
      </>
    ),
  },
  {
    title: 'Encrypted credentials',
    body: 'Tokens are encrypted at rest with AES-256-GCM and never sent to your browser.',
    span: 'md:col-span-2',
    glow: 'rgba(236,72,153,0.16)',
    accent: 'from-pink-500 to-rose-500',
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 118 0v3" />
      </>
    ),
  },
  {
    title: 'Automated scheduling',
    body: 'Queue posts ahead of time and let them go out on their own.',
    span: 'md:col-span-2',
    glow: 'rgba(251,191,36,0.16)',
    accent: 'from-amber-400 to-orange-500',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  },
  {
    title: 'Publishing history',
    body: 'Track every upload from queued to published, with the post ID, a direct link, and a clear reason whenever something fails.',
    span: 'md:col-span-4',
    glow: 'rgba(99,102,241,0.16)',
    accent: 'from-indigo-400 to-violet-500',
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...revealOnScroll} variants={fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Built to remove the{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              repetitive part
            </span>
          </h2>
          <p className="mt-4 text-ink-soft">
            The tedious work of reformatting and re-uploading the same content for every
            audience, handled for you.
          </p>
        </motion.div>

        {/* Bento: a 4-column base where cells claim different spans, so the grid reads as
            composed rather than as a uniform wall of identical cards. Collapses to a
            single column on mobile where varied spans would just look arbitrary. */}
        <motion.div
          {...revealOnScroll}
          variants={staggerContainer}
          className="mt-14 grid grid-cols-1 gap-4 md:auto-rows-[minmax(150px,auto)] md:grid-cols-4"
        >
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp} className={feature.span}>
              <SpotlightCard glow={feature.glow} className="h-full">
                <div className="flex h-full flex-col p-6">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-lg`}
                  >
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
                </div>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
