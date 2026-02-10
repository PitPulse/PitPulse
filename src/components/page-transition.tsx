"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="min-h-screen bg-gray-950"
        initial={
          prefersReducedMotion
            ? false
            : {
                opacity: 0,
                y: 12,
              }
        }
        animate={{ opacity: 1, y: 0 }}
        exit={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 0,
                y: -8,
              }
        }
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {!prefersReducedMotion && (
          <motion.div
            className="pointer-events-none fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-950/80 to-black"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0.2 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        )}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
