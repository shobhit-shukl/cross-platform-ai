'use client';

import { motion } from 'motion/react';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { fadeUp, revealOnScroll, spring, staggerContainer } from '@/lib/motion';

const STEPS = [
  {
    title: 'Connect your accounts',
    body: 'Sign in to each platform through its official consent screen. You approve exactly what CrossPost AI can do, and you can disconnect at any time.',
  },
  {
    title: 'Upload once',
    body: 'Pick your video, add a title and description, choose who can see it. Let AI draft the metadata or write it yourself.',
  },
  {
    title: 'Publish everywhere',
    body: 'We push it to every connected account and track each upload through to a published post — with the link and post ID saved for you.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-white/10 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div {...revealOnScroll} variants={fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Three steps, then it&apos;s{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              automatic
            </span>
          </h2>
          <p className="mt-4 text-ink-soft">
            Connect once. After that, publishing everywhere is a single upload.
          </p>
        </motion.div>

        <motion.ol {...revealOnScroll} variants={staggerContainer} className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.li key={step.title} variants={fadeUp} whileHover={{ y: -6, transition: spring }}>
              <SpotlightCard className="h-full">
                <div className="relative p-7">
                  <span className="pointer-events-none absolute -right-3 -top-7 text-8xl font-extrabold text-white/[0.04]">
                    {index + 1}
                  </span>
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.7)]">
                    {index + 1}
                  </span>
                  <h3 className="relative mt-4 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </SpotlightCard>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
