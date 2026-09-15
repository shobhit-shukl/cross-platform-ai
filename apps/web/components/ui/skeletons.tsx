import { Skeleton } from './skeleton';

/** Mirrors the exact row layout of <ConnectedAccounts> so nothing jumps when it loads. */
export function ConnectedAccountsSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors <VideoGrid>'s card shape: 16:9 thumbnail, title bar, badge row. */
export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-border bg-surface/60">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mirrors <CalendarEventList>'s row layout: time chip, title/description, action buttons. */
export function CalendarEventsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors <DriveFileList>'s row layout: icon, name/size/date, action buttons. */
export function DriveFilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors <LinkedInProfileCard>/<FacebookPageCard>/<InstagramAccountCard>'s shape: avatar + two text lines. */
export function ProfileCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 p-6">
      <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** Mirrors <FacebookVideoList>'s card shape: 16:9 thumbnail, caption line, date line. */
export function FacebookVideosSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-border bg-surface/60">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mirrors <InstagramMediaList>'s card shape: square thumbnail, caption line. */
export function InstagramMediaSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-border bg-surface/60">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mirrors <LinkedInPostList>'s row layout: meta line, 2-line commentary, action button. */
export function LinkedInPostsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-6 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-7 w-14 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors <PublishingJobsList>'s row layout. */
export function PublishingJobsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/60">
      <div className="border-b border-border px-6 py-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
