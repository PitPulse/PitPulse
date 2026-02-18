"use client";

import { useState, type ReactNode } from "react";

const PAGE_SIZE = 20;

interface PaginatedMatchGridProps {
  label: string;
  totalCount: number;
  children: ReactNode[];
}

export function PaginatedMatchGrid({
  label,
  totalCount,
  children,
}: PaginatedMatchGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = children.slice(0, visible);
  const hasMore = visible < totalCount;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
        {label} ({totalCount})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{shown}</div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10"
        >
          Show more ({totalCount - visible} remaining)
        </button>
      )}
    </section>
  );
}
