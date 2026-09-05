"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  isFullScreen?: boolean;
}

export default function Loader({ isOpen, isFullScreen }: Props) {
  const [show, setShow] = useState(isOpen);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      return;
    }
    // Let the exit animation finish.
    timer.current = setTimeout(() => setShow(false), 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isOpen]);

  if (!show) return null;

  const inner = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={
            isFullScreen
              ? "fixed inset-0 z-[9000] grid place-items-center bg-black/40 backdrop-blur-sm"
              : "grid place-items-center py-10"
          }
        >
          <span
            className="grid place-items-center rounded-2xl border border-[var(--card-border)]"
            style={{ width: 64, height: 64, background: "var(--card-bg)", boxShadow: "var(--card-shadow)" }}
          >
            <Loader2 size={26} className="animate-spin" style={{ color: "var(--accent)" }} />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!isFullScreen) return inner;
  return createPortal(inner, document.body);
}
