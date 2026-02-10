"use client";

import { motion, useReducedMotion } from "framer-motion";

type MotionSectionProps = React.ComponentPropsWithoutRef<"section"> & {
  delay?: number;
};

export function MotionSection({
  children,
  delay = 0,
  className,
  ...props
}: MotionSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      {...props}
      className={className}
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: 24,
            }
      }
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.section>
  );
}
