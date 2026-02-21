"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const PAGE_SIZE = 20;

interface PaginatedMatchGridProps {
  label: string;
  totalCount: number;
  children: ReactNode[];
  tourId?: string;
  tourFirstCardId?: string;
}

export function PaginatedMatchGrid({
  label,
  totalCount,
  children,
  tourId,
  tourFirstCardId,
}: PaginatedMatchGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const prefersReducedMotion = useReducedMotion();
  const shown = children.slice(0, visible);
  const hasMore = visible < totalCount;

  return (
    <section data-tour={tourId}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
        {label} ({totalCount})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((card, index) => (
          <motion.div
            key={index}
            data-tour={index === 0 ? tourFirstCardId : undefined}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay: prefersReducedMotion ? 0 : Math.min(index * 0.012, 0.12) }}
          >
            {card}
          </motion.div>
        ))}
      </div>
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
