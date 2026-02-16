"use client";

import { useEffect, useState, useRef } from "react";

interface StatsProps {
  teams: number;
  entries: number;
  matches: number;
  scouts: number;
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
      <div className="font-outfit text-4xl font-bold tabular-nums text-white sm:text-5xl">
        {count.toLocaleString()}{suffix}
      </div>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">{label}</p>
    </div>
  );
}

export function LiveStats({ teams, entries, matches, scouts }: StatsProps) {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-2 divide-white/[0.06] md:grid-cols-4 md:divide-x">
          <AnimatedCounter target={teams} label="Teams" suffix="+" />
          <AnimatedCounter target={entries} label="Scouting Entries" suffix="+" />
          <AnimatedCounter target={matches} label="Matches Tracked" suffix="+" />
          <AnimatedCounter target={scouts} label="Scouts" suffix="+" />
        </div>
      </div>
    </section>
  );
}
