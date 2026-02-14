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
            &copy; {new Date().getFullYear()} PitPilot. Built with Next.js &amp; Supabase.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 transition hover:text-gray-300"
              aria-label="GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
