"use client";

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function StarRating({ label, value, onChange }: StarRatingProps) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
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
}
