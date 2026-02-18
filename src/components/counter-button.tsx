"use client";

import { memo } from "react";

interface CounterButtonProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const CounterButton = memo(function CounterButton({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: CounterButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        id={`counter-label-${label}`}
        className="text-[11px] font-semibold uppercase tracking-wider text-gray-400"
      >
        {label}
      </span>
      <div
        className="flex items-center gap-2"
        role="group"
        aria-labelledby={`counter-label-${label}`}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-bold text-gray-200 transition hover:bg-white/20 active:bg-white/30 disabled:opacity-30"
        >
          &minus;
        </button>
        <span
          role="status"
          aria-live="polite"
          aria-label={`${label}: ${value}`}
          className="w-8 text-center text-xl font-bold text-white"
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-cyan-500 text-lg font-bold text-white shadow-sm transition hover:from-cyan-400 hover:via-sky-400 hover:to-teal-500 active:from-cyan-600 active:to-blue-700 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
});
