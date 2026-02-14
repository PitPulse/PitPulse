"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Sparkles, Workflow } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function HeroAnimations() {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-teal-100"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
          </span>
          PitPilot Beta
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
          className="font-outfit mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl xl:text-[4.2rem]"
        >
          Run your event scouting
          <span className="block bg-gradient-to-r from-teal-200 via-cyan-300 to-teal-400 bg-clip-text text-transparent">
            like a systems team.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: EASE }}
          className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg"
        >
          We blend your live scouting observations with public event context so your
          drive team gets fast, structured, actionable match strategy.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease: EASE }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-teal-300 to-cyan-300 px-7 py-3 text-sm font-semibold text-[#042116] shadow-[0_0_32px_-12px_rgba(67,217,162,0.85)] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 hover:shadow-[0_0_38px_-10px_rgba(67,217,162,0.92)]"
          >
            Start free
          </Link>
          <a
            href="#features"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3 text-sm font-semibold text-slate-200 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-teal-300/40 hover:bg-teal-300/10"
          >
            Explore features
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          className="mt-9 flex flex-wrap items-center gap-5"
        >
          <SignalPill icon={<Workflow className="h-3.5 w-3.5" />} text="Assignment-ready" />
          <SignalPill icon={<Bot className="h-3.5 w-3.5" />} text="AI brief generation" />
          <SignalPill icon={<Sparkles className="h-3.5 w-3.5" />} text="Offline resilient" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.12, ease: EASE }}
        className="relative mx-auto h-[360px] w-full max-w-[430px]"
      >
        <div className="absolute inset-0 rounded-[30px] border border-white/10 bg-[#0f1115]/70 backdrop-blur-xl" />
        <motion.div
          className="pointer-events-none absolute inset-2 rounded-[26px] bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.2),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.2),transparent_45%)]"
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7.5, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="pointer-events-none absolute left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent"
          animate={{ y: [26, 328, 26], opacity: [0, 0.85, 0] }}
          transition={{ duration: 5.2, ease: "easeInOut", repeat: Infinity }}
        />

        <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full border border-teal-300/30 animate-[spin_18s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border border-cyan-300/30 animate-[spin_14s_linear_infinite_reverse]" />
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-teal-300/25 via-cyan-300/20 to-transparent blur-[1px]" />
          <motion.div
            className="absolute inset-9 rounded-full border border-cyan-300/30"
            animate={{ scale: [0.96, 1.04, 0.96], opacity: [0.25, 0.6, 0.25] }}
            transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-12 flex items-center justify-center rounded-full border border-teal-200/35 bg-[#07141a] text-teal-100"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity }}
          >
            <Bot className="h-8 w-8" />
          </motion.div>
        </div>

        <FloatingCard
          className="left-4 top-6"
          title="Pre-match brief"
          value="Ready in 8s"
          delay={0}
        />
        <FloatingCard
          className="right-4 top-20"
          title="Sync status"
          value="Live"
          delay={0.6}
        />
        <FloatingCard
          className="bottom-7 left-1/2 -translate-x-1/2"
          title="Team pulse"
          value="4 new updates"
          delay={1.1}
        />
      </motion.div>
    </div>
  );
}

function SignalPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-300">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-teal-300/30 bg-teal-300/10 text-teal-200">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

function FloatingCard({
  className,
  title,
  value,
  delay,
}: {
  className: string;
  title: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0], x: [0, 2, 0], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay }}
      className={`absolute rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur ${className}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <p className="mt-1 text-sm font-semibold text-teal-100">{value}</p>
    </motion.div>
  );
}
