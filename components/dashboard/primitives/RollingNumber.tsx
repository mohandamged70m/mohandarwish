"use client";

import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  text: string;
  className?: string;
  style?: CSSProperties;
}

export default function RollingNumber({ text, className, style }: Props) {
  return (
    <span className={className} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", ...style }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          style={{ display: "inline-block" }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
