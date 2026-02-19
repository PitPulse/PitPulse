export default function TeamDetailLoading() {
  return (
    <div className="min-h-screen dashboard-page">
      <div className="mx-auto max-w-4xl px-4 pt-32">
        <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-6 w-64 animate-pulse rounded bg-white/15" />
        <div className="mt-1 h-3 w-28 animate-pulse rounded bg-white/5" />
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* EPA Stats skeleton */}
        <div className="rounded-2xl dashboard-panel p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/5 p-3 text-center">
                <div className="mx-auto h-3 w-12 animate-pulse rounded bg-white/10" />
                <div className="mx-auto mt-2 h-7 w-14 animate-pulse rounded bg-white/15" />
              </div>
            ))}
          </div>
        </div>

        {/* Scouting Summary skeleton */}
        <div className="rounded-2xl dashboard-panel p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-blue-500/10 p-3 text-center">
                <div className="mx-auto h-3 w-14 animate-pulse rounded bg-white/10" />
                <div className="mx-auto mt-2 h-6 w-10 animate-pulse rounded bg-white/15" />
              </div>
            ))}
          </div>
        </div>

        {/* Charts skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl dashboard-panel p-6">
              <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-[280px] animate-pulse rounded-xl bg-white/5" />
            </div>
          ))}
        </div>

        {/* Match History skeleton */}
        <div className="rounded-2xl dashboard-panel p-6">
          <div className="h-5 w-44 animate-pulse rounded bg-white/10" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-gray-950/60 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                  <div className="h-5 w-10 animate-pulse rounded bg-white/10" />
                </div>
                <div className="h-4 w-14 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
