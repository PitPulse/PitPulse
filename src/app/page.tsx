import Link from "next/link";
import { HeroAnimations } from "./hero-animations";
import { Navbar } from "@/components/navbar";
import { LiveStats } from "./live-stats";
import { DashboardPreview } from "./dashboard-preview";
import { Testimonials } from "./testimonials";
import { createClient } from "@/lib/supabase/server";
import { MotionSection } from "@/components/motion-section";
import { SiteFooter } from "@/components/site-footer";

async function getStats() {
  try {
    const supabase = await createClient();
    const [orgsRes, entriesRes, matchesRes] = await Promise.all([
      supabase.from("organizations").select("id", { count: "exact", head: true }),
      supabase.from("scouting_entries").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id", { count: "exact", head: true }),
    ]);
    return {
      teams: orgsRes.count ?? 0,
      entries: entriesRes.count ?? 0,
      matches: matchesRes.count ?? 0,
    };
  } catch {
    return { teams: 0, entries: 0, matches: 0 };
  }
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-24">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute top-20 right-1/4 h-72 w-72 rounded-full bg-purple-600/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-600/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-32">
          <HeroAnimations />
        </div>
      </section>

      {/* Live Stats */}
      <LiveStats teams={stats.teams} entries={stats.entries} matches={stats.matches} />

      {/* The Problem + Differentiator */}
      <MotionSection id="problem" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
              The problem
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Scouting tools give stats, not strategy
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Teams are stuck between raw numbers, clunky forms, and alliance
              decisions based on gut feel. There isn&apos;t one place that
              combines your observations with public data and turns it into
              a clear game plan.
            </p>
          </div>

          <div className="mt-14">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
                What makes this different
              </p>
              <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                From scouting notes to match-winning decisions
              </h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400">
                ScoutAI is the only tool that fuses your scouting notes with
                TBA + Statbotics and then delivers plain-English strategy briefs,
                pick lists, and match plans.
              </p>
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/70 to-gray-900/40 shadow-xl shadow-blue-500/5 standout-table">
              <table className="min-w-full text-left text-sm text-gray-300">
                <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-5 py-4">Tool</th>
                    <th className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        What it does
                      </span>
                    </th>
                    <th className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        What it doesn&apos;t do
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr className="transition hover:bg-white/5">
                    <td className="px-5 py-4 font-semibold text-white">
                      TBA / Statbotics
                    </td>
                    <td className="px-5 py-4">
                      Publishes match results, rankings, and EPA.
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      Doesn&apos;t translate stats into match strategy.
                    </td>
                  </tr>
                  <tr className="transition hover:bg-white/5">
                    <td className="px-5 py-4 font-semibold text-white">
                      Google Forms / Sheets
                    </td>
                    <td className="px-5 py-4">
                      Collects raw scouting notes from your team.
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      Doesn&apos;t merge with public data or generate insights.
                    </td>
                  </tr>
                  <tr className="transition hover:bg-white/5">
                    <td className="px-5 py-4 font-semibold text-white">
                      Offline scouting apps
                    </td>
                    <td className="px-5 py-4">
                      Helps capture data when Wi-Fi is unreliable.
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      Doesn&apos;t build pick lists or AI strategy briefs.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-center text-sm text-gray-400">
              ScoutAI combines everything above and adds AI strategy, like a
              data analyst on your drive team.
            </p>
          </div>
        </div>
      </MotionSection>

      {/* Features */}
      <MotionSection id="features" className="relative border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Everything your team needs to win
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Stop guessing. Start winning with data-driven strategy powered by AI.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<ClipboardIcon />}
              title="Smart Scouting Forms"
              description="Mobile-first forms with big tap targets designed for the stands. Works offline at venues, syncs when you're back online."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Unified Data Dashboard"
              description="Auto-imports TBA results and Statbotics EPA. Your scouting observations overlaid on public data in one powerful view."
            />
            <FeatureCard
              icon={<BrainIcon />}
              title="AI Strategy Engine"
              description="Pre-match briefs, post-match analysis, and natural language queries. Ask anything about your event data."
            />
            <FeatureCard
              icon={<TargetIcon />}
              title="Alliance Pick Optimizer"
              description="Ranks every available team by complementarity with your robot. Pick partners based on data with true confidence that you've made the right choice."
            />
            <FeatureCard
              icon={<UsersIcon />}
              title="Team Management"
              description="Invite scouts with a 6-character code. Assign rotations. Role-based access for scouts and captains."
            />
            <FeatureCard
              icon={<WifiOffIcon />}
              title="Offline-First PWA"
              description="Install on your phone like a native app. Scout without WiFi, and sync automatically once you reconnect."
            />
          </div>
        </div>
      </MotionSection>

      {/* How It Works */}
      <MotionSection id="how-it-works" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Three steps to smarter scouting
            </h2>
          </div>

          <div className="relative mt-16 grid gap-12 sm:grid-cols-3">
            {/* Connector lines (hidden on mobile) */}
            <div className="pointer-events-none absolute top-16 left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] hidden h-px sm:block">
              <div className="h-full w-full bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-cyan-500/40" />
            </div>

            <StepScene step={1} color="blue">
              {/* Phone mockup with counter buttons */}
              <div className="mx-auto h-20 w-14 rounded-lg border border-white/20 bg-gray-800/80 p-1.5">
                <div className="h-full rounded-md bg-gray-900/80 p-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 w-6 rounded-full bg-blue-500/40" />
                    <div className="h-3 w-3 rounded bg-blue-500/60 text-[4px] leading-3 text-center font-bold text-white">3</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 w-5 rounded-full bg-blue-500/30" />
                    <div className="h-3 w-3 rounded bg-blue-500/40 text-[4px] leading-3 text-center font-bold text-white">1</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 w-7 rounded-full bg-blue-500/20" />
                    <div className="h-3 w-3 rounded bg-green-500/50 text-[4px] leading-3 text-center font-bold text-white">+</div>
                  </div>
                </div>
              </div>
            </StepScene>

            <StepScene step={2} color="purple">
              {/* Brain with data flowing in */}
              <div className="relative mx-auto h-20 w-20">
                {/* Data dots flowing in */}
                <div className="absolute top-2 left-0 h-2 w-2 animate-pulse rounded-full bg-blue-400/60" />
                <div className="absolute top-6 -left-1 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400/50" style={{ animationDelay: "0.5s" }} />
                <div className="absolute top-10 left-1 h-2 w-2 animate-pulse rounded-full bg-purple-400/40" style={{ animationDelay: "1s" }} />
                <div className="absolute top-3 right-0 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400/50" style={{ animationDelay: "0.3s" }} />
                <div className="absolute top-8 -right-1 h-2 w-2 animate-pulse rounded-full bg-cyan-400/60" style={{ animationDelay: "0.7s" }} />
                {/* Central brain icon */}
                <div className="absolute inset-2 flex items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                  <BrainIcon />
                </div>
              </div>
            </StepScene>

            <StepScene step={3} color="cyan">
              {/* Strategy brief mockup */}
              <div className="mx-auto h-20 w-16 rounded-lg border border-white/20 bg-gray-800/80 p-1.5">
                <div className="h-full space-y-1 rounded-md bg-gray-900/80 p-1.5">
                  <div className="h-1 w-8 rounded-full bg-cyan-500/50" />
                  <div className="flex gap-1">
                    <div className="h-5 w-5 rounded bg-red-500/20 text-[4px] text-center leading-5 font-bold text-red-300">R</div>
                    <div className="h-5 w-5 rounded bg-blue-500/20 text-[4px] text-center leading-5 font-bold text-blue-300">B</div>
                  </div>
                  <div className="h-1 w-full rounded-full bg-green-500/40" />
                  <div className="h-1 w-6 rounded-full bg-white/10" />
                  <div className="h-1 w-8 rounded-full bg-white/10" />
                </div>
              </div>
            </StepScene>
          </div>
        </div>
      </MotionSection>

      {/* Dashboard Preview */}
      <DashboardPreview />

      {/* Testimonials */}
      <Testimonials />

      {/* Pricing */}
      <MotionSection id="pricing" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Free to scout. Upgrade for AI.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Scouting, data sync, and team management are completely free. Unlock unlimited AI strategy with a simple upgrade.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:mx-auto lg:max-w-3xl">
            {/* Free Tier */}
            <div className="rounded-2xl border border-white/10 bg-gray-900/50 p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">Free</p>
              <p className="mt-4 text-4xl font-bold text-white">$0</p>
              <p className="mt-1 text-sm text-gray-400">forever</p>
              <ul className="mt-8 space-y-3 text-sm text-gray-300">
                <PricingItem included>Unlimited scouting entries</PricingItem>
                <PricingItem included>TBA &amp; Statbotics data sync</PricingItem>
                <PricingItem included>Team management &amp; roles</PricingItem>
                <PricingItem included>Offline PWA support</PricingItem>
                <PricingItem included>Team Pulse chat</PricingItem>
                <PricingItem included>3 AI strategy messages</PricingItem>
                <PricingItem included>Standard rate limits</PricingItem>
                <PricingItem>Unlimited AI chat</PricingItem>
                <PricingItem>Alliance pick optimizer</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-lg border border-white/10 py-2.5 text-center text-sm font-semibold text-gray-200 transition hover:bg-white/5"
              >
                Get started
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="relative rounded-2xl border border-blue-500/40 bg-gray-900/80 p-8 shadow-xl shadow-blue-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/30">
                Recommended
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Pro</p>
              <p className="mt-4 text-4xl font-bold text-white">
                $1<span className="text-2xl">.99</span>
              </p>
              <p className="mt-1 text-sm text-gray-400">per month</p>
              <ul className="mt-8 space-y-3 text-sm text-gray-300">
                <PricingItem included>Everything in Free</PricingItem>
                <PricingItem included>Unlimited AI strategy chat</PricingItem>
                <PricingItem included>Alliance pick optimizer</PricingItem>
                <PricingItem included>Pre-match &amp; post-match briefs</PricingItem>
                <PricingItem included>Natural language data queries</PricingItem>
                <PricingItem included>2x higher rate limits</PricingItem>
                <PricingItem included>Priority support</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>

        </div>
      </MotionSection>

      {/* CTA */}
      <MotionSection className="relative overflow-hidden border-t border-white/5 py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to level up your scouting?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join teams already using ScoutAI to make smarter alliance picks and
            win more matches.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="group relative rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 hover:shadow-blue-500/30"
            >
              Get Started Free
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </MotionSection>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-white/10 bg-gray-900/50 p-6 transition-all hover:border-white/20 hover:bg-gray-900/80 hover:shadow-xl hover:shadow-blue-500/5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/20">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        {description}
      </p>
    </div>
  );
}

const stepMeta: Record<number, { title: string; description: string }> = {
  1: {
    title: "Scout matches",
    description:
      "Tap counters and toggles from the stands. Offline-ready, syncs when back online.",
  },
  2: {
    title: "AI analyzes data",
    description:
      "Your scouting observations combine with TBA and Statbotics data for deep analysis.",
  },
  3: {
    title: "Win with strategy",
    description:
      "Pre-match briefs, alliance pick lists, and game plans, all generated in seconds.",
  },
};

const stepColors: Record<string, { badge: string; glow: string }> = {
  blue: { badge: "bg-blue-600 shadow-blue-600/30", glow: "bg-blue-500/10 border-blue-500/20" },
  purple: { badge: "bg-purple-600 shadow-purple-600/30", glow: "bg-purple-500/10 border-purple-500/20" },
  cyan: { badge: "bg-cyan-600 shadow-cyan-600/30", glow: "bg-cyan-500/10 border-cyan-500/20" },
};

function StepScene({
  step,
  color,
  children,
}: {
  step: number;
  color: string;
  children: React.ReactNode;
}) {
  const meta = stepMeta[step];
  const palette = stepColors[color] ?? stepColors.blue;

  return (
    <div className="relative text-center">
      <div
        className={`relative mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-2xl border ${palette.glow}`}
      >
        {children}
        <div
          className={`absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ${palette.badge}`}
        >
          {step}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white">{meta.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        {meta.description}
      </p>
    </div>
  );
}

/* ── SVG Icon Components ── */

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-6" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-1 .5A3.5 3.5 0 0 0 4 11a3.5 3.5 0 0 0 1.5 2.9A4 4 0 0 0 8 18h1" />
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 1 .5A3.5 3.5 0 0 1 20 11a3.5 3.5 0 0 1-1.5 2.9A4 4 0 0 1 16 18h-1" />
      <path d="M12 2v20" />
      <path d="M8 10h1" />
      <path d="M15 10h1" />
      <path d="M9 14h1" />
      <path d="M14 14h1" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function WifiOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h.01" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function PricingItem({
  included,
  children,
}: {
  included?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      {included ? (
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-gray-600"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span className={included ? "" : "text-gray-500"}>{children}</span>
    </li>
  );
}
