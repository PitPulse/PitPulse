interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/5 ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-6 space-y-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-gray-900/40 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  );
}

export function SkeletonChart() {
  const barHeights = [26, 48, 34, 62, 40, 74, 55, 68, 37, 80, 52, 44, 70, 58, 32];
  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-12" />
      </div>
      <div className="flex items-end gap-1 h-32">
        {barHeights.map((height, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${height}%` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-3">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
