'use client';

import { motion, useReducedMotionConfig as useReducedMotion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  blur?: number;
  duration?: number;
  once?: boolean;
};

// Scroll-driven blur + rise reveal for whole-page sections.
// Wraps a section block: fades, rises, unblurs and unclips on enter.
export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 28,
  blur = 8,
  duration = 0.7,
  once = true,
}: ScrollRevealProps) {
  const reduceMotionRaw = useReducedMotion();
  // Gate on mount so SSR + hydration render identically (server snapshot is
  // always "full motion"). Reduced-motion users switch to the simplified
  // variant in a post-hydration update instead of a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const reduceMotion = mounted ? reduceMotionRaw : false;

  if (reduceMotion) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once, margin: '-40px' }}
        transition={{ duration: 0.01, delay }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(' + blur + 'px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration, delay, ease: EASE }}
      style={{ willChange: 'opacity, transform, filter' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
