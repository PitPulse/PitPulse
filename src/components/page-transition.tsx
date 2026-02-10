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
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
