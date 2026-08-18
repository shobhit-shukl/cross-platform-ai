/**
 * Ambient blurred-orb background. Pure CSS (no Framer Motion) since it's a continuous
 * decorative loop with no interaction or orchestration — cheaper, and it's already
 * moving on first paint instead of waiting for JS to hydrate.
 *
 * Perf note: only `transform` is animated. The blur is expensive to rasterize but only
 * has to happen once per orb since its size never changes — only its position drifts.
 *
 * `intensity="high"` is for marketing surfaces (landing, login). `"low"` is for working
 * surfaces (dashboard, create, videos) where a real content grid needs to stay legible
 * and performant underneath it.
 */
export function AnimatedBackground({ intensity = 'high' }: { intensity?: 'high' | 'low' }) {
  const opacity = intensity === 'high' ? 'opacity-40' : 'opacity-[0.15]';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className={`motion-safe:animate-float-slow absolute -left-1/4 -top-1/4 h-[50vw] w-[50vw] rounded-full bg-brand-violet blur-3xl ${opacity}`}
      />
      <div
        className={`motion-safe:animate-float-medium absolute -right-1/4 top-1/3 h-[45vw] w-[45vw] rounded-full bg-brand-cyan blur-3xl ${opacity}`}
      />
      <div
        className={`motion-safe:animate-float-reverse absolute bottom-[-20%] left-1/3 h-[40vw] w-[40vw] rounded-full bg-brand-pink blur-3xl ${opacity}`}
      />
    </div>
  );
}
