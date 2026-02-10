"use client";

interface CounterButtonProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function CounterButton({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: CounterButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg font-bold text-gray-200 transition hover:bg-white/20 active:bg-white/30 disabled:opacity-30"
        >
          &minus;
        </button>
        <span className="w-8 text-center text-xl font-bold text-white">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white transition hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
