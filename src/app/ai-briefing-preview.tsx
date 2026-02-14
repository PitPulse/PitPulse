"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-teal-200"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.12,
          }}
        />
      ))}
    </div>
  );
}

export function AIBriefingPreview() {
  const [phase, setPhase] = useState<
    "idle" | "hover" | "loading" | "reply" | "outro"
  >("idle");
  const cycleTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const clearCycleTimeouts = () => {
      cycleTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      cycleTimeoutsRef.current = [];
    };

    const schedule = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      cycleTimeoutsRef.current.push(id);
    };

    const runCycle = () => {
      clearCycleTimeouts();
      setPhase("idle");
      schedule(() => setPhase("hover"), 900);
      // Simulate click -> loading state, then a 5s generation window.
      schedule(() => setPhase("loading"), 1700);
      schedule(() => setPhase("reply"), 6700);
      // Keep the generated result visible for ~8s, then fade out and restart.
      schedule(() => setPhase("outro"), 14700);
      schedule(runCycle, 15500);
    };

    schedule(runCycle, 2500);

    return () => {
      clearCycleTimeouts();
    };
  }, []);

  return (
    <section className="relative py-24">
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="order-1"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0b1116]/90 p-4 shadow-[0_0_45px_-20px_rgba(67,217,162,0.35)] backdrop-blur-md sm:p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-400">
              AI Briefing Preview
            </p>

            <div className="relative mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Undisclosed Team (Demo)</p>
                  <p className="text-xs text-slate-400">Open team profile and request an AI brief.</p>
                </div>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    phase === "loading"
                      ? "border-teal-300/45 bg-teal-300/20 text-teal-100"
                      : phase === "reply" || phase === "outro"
                      ? "border-blue-300/45 bg-blue-300/20 text-blue-100"
                      : "border-white/20 bg-white/5 text-slate-200"
                  }`}
                >
                  {phase === "loading" ? "Generating..." : "AI Brief"}
                </button>
              </div>

              <motion.div
                className="pointer-events-none absolute right-6 top-4 z-30"
                animate={
                  phase === "hover"
                    ? { x: 0, y: 14, opacity: 1, scale: 1 }
                    : phase === "loading"
                    ? { x: 46, y: -24, opacity: 0, scale: 0.9 }
                    : phase === "reply" || phase === "outro"
                    ? { x: 110, y: -64, opacity: 0, scale: 0.9 }
                    : { x: 130, y: 92, opacity: 0, scale: 1 }
                }
                transition={{
                  duration: phase === "hover" ? 0.7 : phase === "loading" ? 0.35 : 0.3,
                  ease: "easeInOut",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]">
                  <path
                    d="M5 3l7.3 16.4 2.3-6.8L21 10 5 3z"
                    fill="rgba(186,230,253,0.95)"
                    stroke="rgba(125,211,252,0.9)"
                    strokeWidth="1"
                  />
                </svg>
              </motion.div>

              <AnimatePresence>
                {phase === "loading" && (
                  <motion.span
                    initial={{ opacity: 0.45, scale: 0.7 }}
                    animate={{ opacity: 0, scale: 1.7 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="pointer-events-none absolute right-[34px] top-[24px] h-6 w-6 rounded-full border border-teal-200/80"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 min-h-[500px]">
              <div className="flex justify-start">
                {phase === "loading" ? (
                  <div className="w-full max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      PitPilot Assistant
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-teal-100">
                      Building scouting brief
                      <TypingDots />
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="h-2 rounded-full bg-white/10" />
                      <div className="h-2 w-5/6 rounded-full bg-white/10" />
                      <div className="h-2 w-2/3 rounded-full bg-white/10" />
                    </div>
                  </div>
                ) : phase !== "reply" && phase !== "outro" ? (
                  <div className="w-full max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      PitPilot Assistant
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Click AI Brief to generate a team summary.
                    </p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={
                      phase === "outro"
                        ? { opacity: 0, y: -6 }
                        : { opacity: 1, y: 0 }
                    }
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="w-full max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        Team XXX (Demo)
                      </p>
                      <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-2 py-0.5 text-[10px] font-semibold text-teal-200">
                        Generated
                      </span>
                    </div>

                    <div className="relative mt-3 max-h-[380px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,#000_70%,transparent)]">
                      <div className="space-y-4 text-sm text-slate-200">
                        <div>
                          <p className="font-semibold text-white">Team Introduction</p>
                          <p className="mt-1 leading-relaxed text-slate-300">
                            Team XXX brings 26 years of FRC experience as a veteran program, maintaining
                            strong competitive performance with an overall 75.5% win rate across 1,110
                            matches. At this regional, they are demonstrating solid form with a 14-3
                            record and 82.4% win rate, supported by a 74.19 EPA that shows balanced
                            contributions across all match phases.
                          </p>
                        </div>

                        <ul className="list-disc space-y-1.5 pl-5 text-slate-300 marker:text-teal-300">
                          <li>
                            <span className="font-semibold text-white">Years active:</span> 26 seasons (2000 rookie year)
                          </li>
                          <li>
                            <span className="font-semibold text-white">Overall performance:</span> Strong historical competitor with 837-272-1 career record (75.5% win rate)
                          </li>
                          <li>
                            <span className="font-semibold text-white">Performance at this event:</span> Currently 14-3 (82.4% win rate) with 74.19 EPA
                          </li>
                        </ul>

                        <div>
                          <p className="font-semibold text-white">Alliance Fit</p>
                          <ul className="mt-1 list-disc space-y-1.5 pl-5 text-slate-300 marker:text-teal-300">
                            <li>Reliable coral scoring contributor with 47.62 teleop EPA indicating consistent throughput in the main scoring phase.</li>
                            <li>Balanced game approach with meaningful auto contributions (15.95 EPA) and solid endgame execution (10.62 EPA).</li>
                            <li>Proven reliability profile with strong win rates historically and at this regional, suggesting consistent match performance.</li>
                          </ul>
                        </div>

                        <div>
                          <p className="font-semibold text-white">Risks and Unknowns</p>
                          <ul className="mt-1 list-disc space-y-1.5 pl-5 text-slate-300 marker:text-teal-300">
                            <li>Defense impact is less clear in this demo sample; validate against live scouting notes before alliance selection.</li>
                          </ul>
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0f1824]/95" />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Accurate Demo. Values shown here are synthetic sample data.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 lg:pt-4"
        >
          <p className="section-label">Ask Anything</p>
          <h3 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Instant team brief simulation
          </h3>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
            See how we support your strategist: open a team profile, trigger AI Brief, wait for generation,
            and get a structured report with introduction, alliance fit, and risk callouts.
          </p>
        </motion.div>
        </div>
      </div>
    </section>
  );
}
