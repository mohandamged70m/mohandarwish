"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  children,
  delay = 0,
  duration = 0.8,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}): ReactNode {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleUnblur({
  children,
  delay = 0,
  duration = 1,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}): ReactNode {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  // INP: opacity + transform only. The previous filter: blur() forced a
  // full repaint every frame for the whole subtree.
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: Math.min(duration, 0.5), delay, ease: EASE }}
      style={{ transformOrigin: "center", willChange: "opacity, transform" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
