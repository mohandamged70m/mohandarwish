"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string | number;
  render: (item: T) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A list that animates its children into place as items are added or removed. */
export default function Reflow<T>({ items, keyOf, render, className, style }: Props<T>) {
  return (
    <motion.div className={className} style={style} layout>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={keyOf(item)}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {render(item)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
