"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function HeroAnimations() {
  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <p className="mb-4 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400">
          AI-Powered FRC Scouting
        </p>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
      >
        Scout smarter.{" "}
        <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
          Win more.
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-400"
      >
        ScoutAI combines your team&apos;s observations with TBA data, Statbotics
        EPA, and AI analysis to give you a competitive edge at every event.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.45, ease: "easeOut" }}
        className="mt-10 flex items-center justify-center gap-4"
      >
        <Link
          href="/signup"
          className="group relative rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 hover:shadow-blue-500/30"
        >
          Get Started Free
          <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
            &rarr;
          </span>
        </Link>
        <a
          href="#features"
          className="rounded-lg border border-white/10 bg-white/5 px-8 py-3 text-base font-semibold text-gray-300 transition hover:border-white/20 hover:bg-white/10"
        >
          See Features
        </a>
      </motion.div>
    </div>
  );
}
