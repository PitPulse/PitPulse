import Link from "next/link";
import {
  Bot,
  Check,
  ClipboardList,
  Database,
  GaugeCircle,
  Handshake,
  Smartphone,
  Users,
} from "lucide-react";
import { HeroAnimations } from "./hero-animations";
import { Navbar } from "@/components/navbar";
import { LiveStats } from "./live-stats";
import { DashboardPreview } from "./dashboard-preview";
import { AIBriefingPreview } from "./ai-briefing-preview";
import { Testimonials } from "./testimonials";
import { createClient } from "@/lib/supabase/server";
import { MotionSection } from "@/components/motion-section";
import { SiteFooter } from "@/components/site-footer";

type Feature = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Step = {
  label: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    title: "Smart scouting forms",
    description:
      "We built fast mobile forms for your scouts in the stands, with touch-first controls and reliable offline capture.",
    icon: ClipboardList,
  },
  {
    title: "Unified event intelligence",
    description:
      "We bring your PitPilot entries, TBA schedules/results, and Statbotics context together in one shared view.",
    icon: Database,
  },
  {
    title: "Pre-match AI briefs",
    description:
      "We generate concise pre-match plans for you with priorities, risks, and role focus before each match.",
    icon: Bot,
  },
  {
    title: "Alliance pick optimizer",
    description:
      "We rank teams by fit with your robot, not just raw EPA, so you can draft with intent.",
    icon: Handshake,
  },
  {
    title: "Team operations",
    description:
      "Your captains can manage roles, assignments, and communication without leaving the dashboard.",
    icon: Users,
  },
  {
    title: "Competition-ready reliability",
    description:
      "We keep you moving with offline-first behavior, sync recovery, and resilient UX for real venue networks.",
    icon: Smartphone,
  },
];

const STEPS: Step[] = [
  {
    label: "Step 01",
    title: "Capture",
    description:
      "Your scouts submit structured match notes quickly from phones with low-friction tap controls.",
  },
  {
    label: "Step 02",
    title: "Contextualize",
    description:
      "We layer your scouting signal with event data so you can see a complete performance picture.",
  },
  {
    label: "Step 03",
    title: "Execute",
    description:
      "Your drive team gets focused briefs and pick recommendations in time for real decisions.",
  },
];

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
    <div className="landing-noise min-h-screen bg-[#03070a] text-white">
      <Navbar />

      <section className="relative overflow-hidden pt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-36 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-teal-400/10 blur-[140px]" />
          <div className="absolute top-24 right-[16%] h-[320px] w-[320px] rounded-full bg-cyan-400/10 blur-[120px]" />
          <div className="absolute bottom-0 left-[8%] h-[260px] w-[260px] rounded-full bg-teal-300/10 blur-[120px]" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.5)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-28 lg:py-32">
          <HeroAnimations />
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#03070a] to-transparent" />
      </section>

      <LiveStats teams={stats.teams} entries={stats.entries} matches={stats.matches} />

      <MotionSection id="problem" className="relative py-24">
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-label">Why teams switch</p>
            <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Strategy is not a spreadsheet problem
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-400 md:text-lg">
              Most tools stop at data collection. We help you turn raw scouting signal into
              match-ready decisions with clear priorities and confidence.
            </p>
          </div>

          <div className="mt-14 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]/85 backdrop-blur-xl shadow-[0_0_40px_-18px_rgba(67,217,162,0.35)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Tool</th>
                  <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">What it does</th>
                  <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">What it misses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr className="transition-colors duration-300 hover:bg-white/[0.03]">
                  <td className="px-6 py-4 font-semibold text-white">TBA / Statbotics</td>
                  <td className="px-6 py-4 text-slate-300">Publishes schedule, results, rankings, and EPA context.</td>
                  <td className="px-6 py-4 text-slate-500">Doesn&apos;t turn that data into your next-match plan.</td>
                </tr>
                <tr className="transition-colors duration-300 hover:bg-white/[0.03]">
                  <td className="px-6 py-4 font-semibold text-white">Forms / sheets workflows</td>
                  <td className="px-6 py-4 text-slate-300">Collects team notes and subjective observations.</td>
                  <td className="px-6 py-4 text-slate-500">You still have to convert it into strategy under time pressure.</td>
                </tr>
                <tr className="transition-colors duration-300 hover:bg-white/[0.03]">
                  <td className="px-6 py-4 font-semibold text-white">PitPilot</td>
                  <td className="px-6 py-4 text-slate-300">We combine both + generate tactical pre-match guidance.</td>
                  <td className="px-6 py-4 text-slate-500">We don&apos;t replace your scouts; we amplify them.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </MotionSection>

      <MotionSection id="features" className="relative py-24">
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <p className="section-label">Core capabilities</p>
            <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Built for high-pressure match days
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </MotionSection>

      <MotionSection id="how-it-works" className="relative py-24">
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center">
            <p className="section-label">How it works</p>
            <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              One clean scouting loop
            </h2>
          </div>

          <div className="relative mt-14 space-y-5 md:grid md:grid-cols-3 md:gap-6 md:space-y-0">
            <div className="pointer-events-none absolute left-5 top-8 hidden h-[calc(100%-80px)] w-px bg-gradient-to-b from-teal-400/60 to-transparent md:hidden" />
            {STEPS.map((step, index) => (
              <article
                key={step.label}
                className="relative rounded-2xl border border-white/10 bg-[#0f1115]/80 p-6 backdrop-blur-md shadow-[0_0_28px_-18px_rgba(67,217,162,0.35)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-teal-300/35 hover:shadow-[0_0_36px_-16px_rgba(67,217,162,0.58)]"
              >
                <div className="mb-4 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-teal-300/30 bg-teal-300/15 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200">
                  {step.label}
                </div>
                <h3 className="font-outfit text-xl font-semibold text-blue-400">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.description}</p>
                <div className="pointer-events-none absolute right-4 top-4 font-mono text-xs text-slate-600">
                  0{index + 1}
                </div>
              </article>
            ))}
          </div>
        </div>
      </MotionSection>

      <DashboardPreview />
      <AIBriefingPreview />
      <Testimonials />

      <MotionSection id="pricing" className="relative py-24">
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="section-label">Pricing</p>
            <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Community-first, team-friendly
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400 md:text-base">
              Free gives you everything you need to scout real events. Supporter gives your
              team more AI headroom and helps us keep PitPilot fast and reliable for everyone.
            </p>
          </div>

          <div className="mt-14 grid justify-items-center gap-4 md:grid-cols-2">
            <div className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#0f1115]/80 p-8 backdrop-blur-md transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-teal-300/30 hover:shadow-[0_0_34px_-18px_rgba(67,217,162,0.34)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">Free</p>
              <p className="font-outfit mt-4 text-5xl font-bold">$0</p>
              <p className="mt-1 text-sm text-slate-500">forever</p>
              <div className="my-6 h-px bg-white/10" />
              <ul className="space-y-3 text-sm text-slate-300">
                <PricingItem included>Unlimited scouting entries</PricingItem>
                <PricingItem included>TBA + Statbotics sync</PricingItem>
                <PricingItem included>Pre-match briefs + pick optimizer</PricingItem>
                <PricingItem included>Team Pulse + assignment workflows</PricingItem>
                <PricingItem included>Unlimited prompts with usage limits</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-teal-300/45 hover:bg-teal-300/10"
              >
                Start Free
              </Link>
            </div>

            <div className="relative w-full max-w-[360px] rounded-2xl border border-teal-300/35 bg-gradient-to-b from-teal-300/15 to-transparent p-8 shadow-[0_0_40px_-20px_rgba(67,217,162,0.55)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-teal-200/60 hover:shadow-[0_0_44px_-18px_rgba(67,217,162,0.78)]">
              <div className="absolute -top-3 left-6 rounded-full border border-teal-200/70 bg-teal-300 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[#042116] shadow-[0_8px_18px_-10px_rgba(67,217,162,0.8)]">
                Support us
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-200">Supporter</p>
              <p className="font-outfit mt-4 text-5xl font-bold">$5.99</p>
              <p className="mt-1 text-sm text-slate-300">per team / month</p>
              <div className="my-6 h-px bg-teal-200/25" />
              <ul className="space-y-3 text-sm text-slate-100">
                <PricingItem included>Everything in Free</PricingItem>
                <PricingItem included>Higher AI usage limits</PricingItem>
                <PricingItem included>Priority model capacity</PricingItem>
                <PricingItem included>Directly supports platform reliability</PricingItem>
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-[#042116] shadow-[0_0_28px_-12px_rgba(67,217,162,0.8)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 hover:shadow-[0_0_34px_-10px_rgba(67,217,162,0.88)]"
              >
                Upgrade to Supporter
              </Link>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300/12 blur-[130px]" />
        </div>
        <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <p className="section-label">Start scouting better</p>
          <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Ready for cleaner decisions at your next event?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm text-slate-400 md:text-base">
            We built PitPilot to reduce match-day chaos so your drive team can
            act with confidence.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-8 py-3 text-sm font-semibold text-[#042116] shadow-[0_0_30px_-12px_rgba(67,217,162,0.8)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 hover:shadow-[0_0_36px_-10px_rgba(67,217,162,0.88)]"
            >
              Create free account
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm font-semibold text-slate-200 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-teal-300/50 hover:bg-teal-300/10"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </MotionSection>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]/85 p-6 backdrop-blur-md transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-teal-300/40 hover:shadow-[0_0_34px_-18px_rgba(67,217,162,0.6)]">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 border-r border-t border-teal-300/25 opacity-0 transition group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-16 w-16 border-b border-l border-teal-300/25 opacity-0 transition group-hover:opacity-100" />
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/25 bg-teal-300/10 text-teal-200 shadow-[0_0_20px_-12px_rgba(67,217,162,0.9)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-outfit text-xl font-semibold text-blue-400">{feature.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{feature.description}</p>
    </article>
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
    <li className="flex items-start gap-3">
      {included ? (
        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-300/20 text-teal-200">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-700/30 text-slate-500">
          <GaugeCircle className="h-3 w-3" />
        </span>
      )}
      <span>{children}</span>
    </li>
  );
}
