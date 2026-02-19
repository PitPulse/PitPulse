export default function MatchesLoading() {
  return (
    <div className="min-h-screen dashboard-page">
      <div className="mx-auto max-w-2xl px-4 pt-32">
        <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/5" />
      </div>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl dashboard-panel p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                <div className="h-5 w-14 animate-pulse rounded bg-white/10" />
              </div>
              <div className="mb-1 flex gap-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-7 flex-1 animate-pulse rounded bg-red-500/20" />
                ))}
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-7 flex-1 animate-pulse rounded bg-blue-500/20" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
