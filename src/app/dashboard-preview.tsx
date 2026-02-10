"use client";

import { motion } from "framer-motion";

export function DashboardPreview() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
            See It In Action
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            A dashboard built for the stands
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Mobile-first design means your scouts can work from their phones.
            Big buttons, fast data entry, no fumbling.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mt-12"
        >
          {/* Browser chrome mockup */}
          <div className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-gray-900/60 shadow-2xl shadow-blue-500/5 overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-gray-500">
                scoutai.app/dashboard/events/2025miket
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="h-5 w-48 rounded bg-white/10" />
                  <div className="mt-1 h-3 w-32 rounded bg-white/5" />
                </div>
                <div className="flex gap-2">
                  <div className="rounded-md bg-blue-500/20 px-3 py-1.5 text-xs text-blue-400 font-medium">
                    Sync Matches
                  </div>
                  <div className="rounded-md bg-orange-500/20 px-3 py-1.5 text-xs text-orange-400 font-medium">
                    Assignments
                  </div>
                </div>
              </div>

              {/* Match grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Match card 1 */}
                <MatchMockup
                  label="Qual 14"
                  score="132 - 118"
                  redTeams={["2090", "254", "1678"]}
                  blueTeams={["118", "3310", "2056"]}
                  scouted={["254", "118"]}
                  hasBrief
                />
                {/* Match card 2 */}
                <MatchMockup
                  label="Qual 15"
                  redTeams={["971", "2443", "4414"]}
                  blueTeams={["2910", "148", "1323"]}
                  assigned={["2443"]}
                />
                {/* Match card 3 */}
                <MatchMockup
                  label="Qual 16"
                  redTeams={["3357", "6328", "125"]}
                  blueTeams={["1986", "4481", "2614"]}
                />
                {/* Match card 4 */}
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
    <div className="rounded-lg border border-white/5 bg-gray-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        <div className="flex items-center gap-2">
          {score && (
            <span className="text-xs text-gray-500">{score}</span>
          )}
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              hasBrief
                ? "bg-purple-500/20 text-purple-400"
                : "bg-white/5 text-gray-500"
            }`}
          >
            {hasBrief ? "View Brief" : "AI Brief"}
          </span>
        </div>
      </div>
      <div className="mb-1 flex gap-1">
        {redTeams.map((t) => (
          <span
            key={t}
            className={`flex-1 rounded px-1.5 py-1 text-center text-[10px] font-medium ${
              scouted.includes(t)
                ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                : assigned.includes(t)
                ? "bg-red-500/15 text-red-400 ring-1 ring-orange-500/40"
                : "bg-red-500/10 text-red-400/70"
            }`}
          >
            {t}
            {scouted.includes(t) ? " \u2713" : assigned.includes(t) ? " \u2605" : ""}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {blueTeams.map((t) => (
          <span
            key={t}
            className={`flex-1 rounded px-1.5 py-1 text-center text-[10px] font-medium ${
              scouted.includes(t)
                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                : "bg-blue-500/10 text-blue-400/70"
            }`}
          >
            {t}
            {scouted.includes(t) ? " \u2713" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
