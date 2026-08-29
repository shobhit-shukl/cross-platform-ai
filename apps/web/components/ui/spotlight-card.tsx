'use client';

import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
import type { MouseEvent, ReactNode } from 'react';

/**
 * Card with a glow that follows the cursor across its surface.
 *
 * Implemented with Framer Motion motion values rather than React state: the pointer
 * position is written straight to the DOM on every mousemove without re-rendering the
 * component. Doing this with useState would re-render the whole subtree on every pixel
 * of movement, which gets expensive fast when a grid has a dozen of these.
 *
 * The glow is a radial-gradient layer whose centre is driven by --x/--y, sitting above
 * the background but below the content, and revealed only on hover.
 */
export function SpotlightCard({
  children,
  className = '',
  glow = 'rgba(139,92,246,0.14)',
}: {
  children: ReactNode;
  className?: string;
  /** Colour of the cursor halo. Defaults to the brand violet. */
  glow?: string;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, ${glow}, transparent 78%)`;

  return (
    <div
      onMouseMove={reduceMotion ? undefined : handleMouseMove}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-surface/60 backdrop-blur transition-colors duration-300 hover:border-brand-violet/50 ${className}`}
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
