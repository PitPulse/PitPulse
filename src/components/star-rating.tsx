"use client";

import { memo, useCallback } from "react";

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export const StarRating = memo(function StarRating({ label, value, onChange }: StarRatingProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = value;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        next = value >= 5 ? 1 : value + 1;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        next = value <= 1 ? 5 : value - 1;
      } else {
        return;
      }
      e.preventDefault();
      onChange(next);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-1">
      <span id={`star-label-${label}`} className="text-sm font-medium text-gray-300">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`star-label-${label}`}
        className="flex gap-1"
        onKeyDown={handleKeyDown}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star <= value}
            aria-label={`${star} of 5 stars`}
            tabIndex={star === value ? 0 : -1}
            onClick={() => onChange(star)}
            className="text-2xl transition-transform hover:scale-110 active:scale-110"
          >
            {star <= value ? (
              <span className="text-yellow-400">&#9733;</span>
            ) : (
              <span className="text-gray-600">&#9733;</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});
