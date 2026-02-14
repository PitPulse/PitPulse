"use client";

import { motion } from "framer-motion";

export function DashboardPreview() {
  return (
    <section className="relative py-24">
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <p className="section-label">See it in action</p>
          <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Interface built for match tempo
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            We keep your flow clear with assignment controls, quick brief access, and
            high-contrast team grids built for noisy stands.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1116] shadow-[0_0_50px_-20px_rgba(67,217,162,0.35)]">
            <motion.div
              className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full bg-teal-300/20 blur-2xl"
              animate={{ opacity: [0.2, 0.45, 0.2], scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl"
              animate={{ opacity: [0.2, 0.38, 0.2], scale: [1.05, 0.9, 1.05] }}
              transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              </div>
              <div className="ml-2 rounded-md border border-white/10 bg-black/35 px-3 py-1 font-mono text-[11px] text-slate-400">
                pitpilot.app/dashboard/events/2026miket
              </div>
              <motion.span
                className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-teal-300"
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="relative p-4 sm:p-6">
              <motion.div
                className="pointer-events-none absolute left-6 right-6 top-16 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent"
                animate={{ opacity: [0, 0.8, 0], x: ["-24%", "24%", "-24%"] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="h-4 w-52 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-28 rounded-full bg-white/5" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge label="Scout" tone="teal" />
                  <Badge label="Assignments" tone="cyan" />
                  <Badge label="AI Brief" tone="slate" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MatchMockup
                  label="Qual 14"
                  score="132 - 118"
                  redTeams={["2090", "254", "1678"]}
                  blueTeams={["118", "3310", "2056"]}
                  scouted={["254", "118"]}
                  hasBrief
                />
                <MatchMockup
                  label="Qual 15"
                  redTeams={["971", "2443", "4414"]}
                  blueTeams={["2910", "148", "1323"]}
                  assigned={["2443"]}
                />
                <MatchMockup
                  label="Qual 16"
                  redTeams={["3357", "6328", "125"]}
                  blueTeams={["1986", "4481", "2614"]}
                />
                <MatchMockup
                  label="Semi 1"
                  redTeams={["2090", "254", "971"]}
                  blueTeams={["118", "1678", "2443"]}
                  hasBrief
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Badge({ label, tone }: { label: string; tone: "teal" | "cyan" | "slate" }) {
  const tones: Record<typeof tone, string> = {
    teal: "bg-teal-300/20 text-teal-200 border-teal-300/30",
    cyan: "bg-cyan-300/20 text-cyan-200 border-cyan-300/30",
    slate: "bg-white/10 text-slate-300 border-white/15",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function MatchMockup({
  label,
  score,
  redTeams,
  blueTeams,
  scouted = [],
  assigned = [],
  hasBrief = false,
}: {
  label: string;
  score?: string;
  redTeams: string[];
  blueTeams: string[];
  scouted?: string[];
  assigned?: string[];
  hasBrief?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-teal-300/35 hover:shadow-[0_0_20px_-12px_rgba(67,217,162,0.55)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium text-blue-400">{label}</span>
        <div className="flex items-center gap-2">
          {score && <span className="font-mono text-[11px] text-slate-500">{score}</span>}
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              hasBrief
                ? "border border-teal-300/30 bg-teal-300/15 text-teal-200"
                : "border border-white/15 bg-white/5 text-slate-500"
            }`}
          >
            {hasBrief ? "Brief" : "Pending"}
          </span>
        </div>
      </div>
      <div className="mb-1 flex gap-1">
        {redTeams.map((team) => (
          <TeamChip
            key={team}
            team={team}
            tone="red"
            scouted={scouted.includes(team)}
            assigned={assigned.includes(team)}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {blueTeams.map((team) => (
          <TeamChip
            key={team}
            team={team}
            tone="blue"
            scouted={scouted.includes(team)}
            assigned={assigned.includes(team)}
          />
        ))}
      </div>
    </div>
  );
}

function TeamChip({
  team,
  tone,
  scouted,
  assigned,
}: {
  team: string;
  tone: "red" | "blue";
  scouted: boolean;
  assigned: boolean;
}) {
  const base = tone === "red" ? "bg-red-400/8 text-red-200/70" : "bg-cyan-300/10 text-cyan-200/70";

  const state = scouted
    ? tone === "red"
      ? "ring-1 ring-red-300/40 bg-red-400/20 text-red-100"
      : "ring-1 ring-cyan-300/45 bg-cyan-300/20 text-cyan-100"
    : assigned
    ? "ring-1 ring-teal-300/40 bg-teal-300/14 text-teal-100"
    : base;

  return (
    <span className={`flex-1 rounded-md px-1.5 py-1 text-center font-mono text-[10px] font-medium ${state}`}>
      {team}
      {scouted ? " ✓" : ""}
    </span>
  );
}
