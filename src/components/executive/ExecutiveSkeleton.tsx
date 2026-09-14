/**
 * Skeleton loading states for the Executive Command Center sections.
 * Prevents layout shift and communicates loading clearly.
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card animate-pulse ${className}`}
      aria-hidden="true"
    >
      <div className="p-6 space-y-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function SnapshotSkeleton() {
  return (
    <div
      className="rounded-3xl border border-border bg-card animate-pulse"
      aria-hidden="true"
    >
      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="h-5 w-1/4 rounded bg-muted" />
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="h-24 rounded-2xl bg-muted" />
            <div className="h-24 rounded-2xl bg-muted" />
            <div className="h-24 rounded-2xl bg-muted" />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="h-48 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-5 w-16 rounded bg-muted" />
          </div>
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function MetricGridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div
      className={`grid gap-4 grid-cols-2 md:grid-cols-${cols}`}
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2"
        >
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="h-7 w-1/3 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** Full-page executive loading skeleton shown while initial data loads */
export function ExecutivePageSkeleton() {
  return (
    <div className="space-y-6 pb-16" aria-label="Loading executive data...">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      <SnapshotSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
