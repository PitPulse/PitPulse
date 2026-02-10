"use client";

import { useEffect, useState, useRef } from "react";

interface StatsProps {
  teams: number;
  entries: number;
  matches: number;
}

function AnimatedCounter({ target, label, suffix }: { target: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1500;
          const start = performance.now();

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-extrabold tabular-nums sm:text-5xl">
        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          {count.toLocaleString()}{suffix}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-400">{label}</p>
    </div>
  );
}

export function LiveStats({ teams, entries, matches }: StatsProps) {
  return (
    <section className="border-t border-white/5 py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-3 gap-8">
          <AnimatedCounter target={teams} label="Teams Registered" suffix="+" />
          <AnimatedCounter target={entries} label="Scouting Entries" suffix="+" />
          <AnimatedCounter target={matches} label="Matches Tracked" suffix="+" />
        </div>
      </div>
    </section>
  );
}
