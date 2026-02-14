"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: 8,
            }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
