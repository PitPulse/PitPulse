export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen dashboard-page">
      <div className="mx-auto max-w-5xl px-4 pt-32">
        <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-6 w-56 animate-pulse rounded bg-white/15" />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Export bar skeleton */}
        <div className="flex items-center gap-3 rounded-2xl dashboard-panel px-4 py-3">
          <div className="h-4 w-14 animate-pulse rounded bg-white/10" />
          <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
          <div className="h-7 w-36 animate-pulse rounded-lg bg-white/10" />
        </div>

        {/* Team selector skeleton */}
        <div className="rounded-2xl dashboard-panel p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-16 animate-pulse rounded-lg bg-white/10"
              />
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl dashboard-panel p-6">
                <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
                <div className="mt-4 h-[280px] animate-pulse rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Overview table skeleton */}
        <div className="rounded-2xl dashboard-panel p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 flex-1 animate-pulse rounded bg-white/10"
                />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-4 flex-1 animate-pulse rounded bg-white/5"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
