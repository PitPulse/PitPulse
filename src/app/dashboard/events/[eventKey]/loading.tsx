export default function EventLoading() {
  return (
    <div className="min-h-screen dashboard-page">
      <div className="mx-auto max-w-6xl px-4 pt-32">
        <div className="h-7 w-56 animate-pulse rounded-md bg-white/10" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-white/5" />
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Stat cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl dashboard-panel p-4">
              <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>

        {/* Action buttons skeleton */}
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-32 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      </main>
    </div>
  );
}
