"use client";

import { useEffect, useMemo, useState } from "react";

type UsageLimitMeterProps = {
  limit: number;
  remaining: number;
  resetAt: number;
  windowHours: number;
};

function formatResetCountdown(resetAt: number): string {
  const msRemaining = Math.max(0, resetAt - Date.now());
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
      2,
      "0"
    )}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${Math.max(0, seconds)}s`;
}

export function UsageLimitMeter({
  limit,
  remaining,
  resetAt,
  windowHours,
}: UsageLimitMeterProps) {
  const used = Math.max(0, limit - remaining);
  const usedPct = useMemo(() => {
    if (limit <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
  }, [limit, used]);
  const isExhausted = usedPct >= 100;
  const fillWidth = used <= 0 ? "0%" : `${Math.max(usedPct, 4)}%`;
  const fillBackground = isExhausted
    ? "linear-gradient(90deg, #fb7185 0%, #f59e0b 100%)"
    : "linear-gradient(90deg, #22d3ee 0%, #34d399 100%)";

  const [countdown, setCountdown] = useState("--");

  useEffect(() => {
    if (!isExhausted) return;

    const updateCountdown = () => {
      setCountdown(formatResetCountdown(resetAt));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [isExhausted, resetAt]);

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
          Team AI Usage Limits
        </p>
        <p className="text-xs font-semibold text-white">
          {used}/{limit} used
        </p>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: fillWidth,
            background: fillBackground,
            boxShadow: isExhausted
              ? "0 0 0 1px rgba(251,113,133,0.35), 0 0 14px rgba(251,113,133,0.4)"
              : "0 0 0 1px rgba(34,211,238,0.3), 0 0 12px rgba(34,211,238,0.28)",
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-gray-300">
          Current plan:{" "}
          <span className="font-semibold text-white">
            {limit} interactions per {windowHours}h
          </span>
        </p>
        <p className={isExhausted ? "font-medium text-amber-300" : "text-gray-400"}>
          {isExhausted
            ? `100% used · resets in ${countdown}`
            : `${usedPct}% used this window`}
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Usage limits may vary over time depending on load.
      </p>
    </div>
  );
}
