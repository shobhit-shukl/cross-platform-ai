'use client';

import { motion } from 'motion/react';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';
import { AuthCta } from './auth-cta';

export function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <motion.div
        {...revealOnScroll}
        variants={staggerContainer}
        className="bg-noise relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-surface/70 px-6 py-20 text-center backdrop-blur"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-brand-gradient-soft" />
        <div aria-hidden className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
        {/* Glow bleeding in from the top edge, so the panel reads as lit rather than flat. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full bg-brand-violet/25 blur-3xl"
        />

        <motion.h2 variants={fadeUp} className="relative text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Stop uploading the same video{' '}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            five times
          </span>
        </motion.h2>
        <motion.p variants={fadeUp} className="relative mx-auto mt-4 max-w-xl text-ink-soft">
          Connect your YouTube channel and publish your first video in a couple of
          minutes. More platforms are on the way.
        </motion.p>

        <motion.div variants={fadeUp} className="relative mt-9 flex justify-center">
          <AuthCta variant="hero" />
        </motion.div>
      </motion.div>
    </section>
  );
}
