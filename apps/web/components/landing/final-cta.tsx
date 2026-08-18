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
        className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border-strong bg-surface/70 px-6 py-16 text-center backdrop-blur"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-brand-gradient-soft"
        />

        <motion.h2 variants={fadeUp} className="relative text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Stop uploading the same video five times
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
