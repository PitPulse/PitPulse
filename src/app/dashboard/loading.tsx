export default function DashboardLoading() {
  return (
    <div className="min-h-screen dashboard-page">
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-28">
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl dashboard-panel p-6">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-7 w-48 animate-pulse rounded bg-white/20" />
            <div className="mt-2 h-4 w-40 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-4 w-56 animate-pulse rounded bg-white/10" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl dashboard-panel p-4">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-6 w-16 animate-pulse rounded bg-white/20" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl dashboard-panel p-6">
              <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-9 w-24 animate-pulse rounded bg-white/20" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl dashboard-panel p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
