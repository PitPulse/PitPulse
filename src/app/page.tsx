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
              description="Invite scouts with a 6-character code. Assign rotations. Role-based access for scouts, strategists, and captains."
            />
            <FeatureCard
              icon={<WifiOffIcon />}
              title="Offline-First PWA"
              description="Install on your phone like a native app. Scout without WiFi. QR code backup for when connectivity fails."
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

          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            <StepCard
              step={1}
              icon={<TapIcon />}
              title="Scout matches"
              description="Your scouts tap counter buttons from the stands. Fast, no typing needed. Data flows into your dashboard instantly."
            />
            <StepCard
              step={2}
              icon={<CpuIcon />}
              title="AI analyzes everything"
              description="ScoutAI combines your observations with TBA results and Statbotics EPA to build a complete picture of every team."
            />
            <StepCard
              step={3}
              icon={<TrophyIcon />}
              title="Win your matches"
              description="Get AI-generated strategy briefs before each match. Know exactly where opponents are weak and how to exploit them."
            />
          </div>
        </div>
      </MotionSection>

      {/* Dashboard Preview */}
      <DashboardPreview />

      {/* Testimonials */}
      <Testimonials />

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

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-gray-900/80 text-blue-400">
        {icon}
        <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-600/30">
          {step}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        {description}
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

function TapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 16" />
    </svg>
  );
}

function CpuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
