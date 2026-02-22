import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`relative bg-[#06080f] text-white ${className}`.trim()}>
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_220px_at_20%_0%,rgba(59,130,246,0.1),transparent_65%)]" />
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="font-outfit text-lg font-bold tracking-tight text-white">
              Pit<span className="text-teal-400">Pilot</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              AI-powered scouting and strategy platform built for the FIRST Robotics community.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Product
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/#features" className="text-gray-400 transition hover:text-white">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-gray-400 transition hover:text-white">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-gray-400 transition hover:text-white">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Resources
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="https://www.thebluealliance.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition hover:text-white">
                  The Blue Alliance
                </a>
              </li>
              <li>
                <a href="https://www.statbotics.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition hover:text-white">
                  Statbotics
                </a>
              </li>
              <li>
                <a href="https://www.firstinspires.org" target="_blank" rel="noopener noreferrer" className="text-gray-400 transition hover:text-white">
                  FIRST Inspires
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Account
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/login" className="text-gray-400 transition hover:text-white">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-gray-400 transition hover:text-white">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 transition hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 transition hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-8 sm:flex-row">
          <p className="text-[11px] text-gray-500">
            &copy; {new Date().getFullYear()} PitPilot.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[11px] text-gray-500 transition hover:text-gray-300">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
