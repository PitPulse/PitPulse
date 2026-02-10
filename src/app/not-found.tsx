import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
      <div className="text-center">
        <p className="text-7xl font-extrabold">
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            404
          </span>
        </p>
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/10"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
