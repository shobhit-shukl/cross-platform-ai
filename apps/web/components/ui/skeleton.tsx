/**
 * Base shimmer block. Compose these into content-shaped skeletons (see
 * VideoGridSkeleton, ConnectedAccountsSkeleton, ...) rather than using a generic
 * spinner, so the layout doesn't jump once real data replaces it.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-white/[0.06] ${className}`}>
      <div className="motion-safe:animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
