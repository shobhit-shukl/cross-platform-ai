import type { Transition, Variants } from 'motion/react';

/**
 * Shared animation primitives so every surface uses the same feel instead of bespoke
 * timings per component. `spring` is the "funky" signature — a slight overshoot rather
 * than a plain ease. `smooth` is for anything larger/slower where overshoot would look
 * sloppy (page-level fades, backgrounds).
 */
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 22, mass: 0.6 };
export const smooth: Transition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: smooth },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: spring },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** For elements that scroll into view: animate once, a little before they're fully visible. */
export const revealOnScroll = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, margin: '-80px' },
};

export const tapScale = { scale: 0.96 };
export const hoverLift = { y: -4, transition: spring };
