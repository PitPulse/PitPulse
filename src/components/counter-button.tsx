"use client";

import { memo, useState, useRef, useCallback } from "react";

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed) return; // keep current value
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(min, Math.min(max, parsed)));
  }, [draft, min, max, onChange]);

  const startEditing = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
    // Focus after React renders the input
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

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

        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            className="h-10 w-14 rounded-lg border border-cyan-400/40 bg-white/10 text-center text-xl font-bold text-white outline-none ring-1 ring-cyan-400/30 focus:border-cyan-400/60 focus:ring-cyan-400/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={`Type ${label} value`}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            role="status"
            aria-live="polite"
            aria-label={`${label}: ${value} — tap to type`}
            className="flex h-10 w-14 cursor-text items-center justify-center rounded-lg border border-transparent text-xl font-bold text-white transition hover:border-white/20 hover:bg-white/5 active:bg-white/10"
            title="Tap to type a value"
          >
            {value}
          </button>
        )}

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
