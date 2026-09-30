"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { backdropMotion, PANEL_ORIGIN, panelMotion, wrapperMotion } from "./booking-variants";

// Transition shell for the booking modal: backdrop wash, centering layer,
// spring panel. Layout/styles stay with the caller; all motion lives here.

export function BookingBackdrop({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <motion.div
      {...backdropMotion}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 1400,
      }}
      onClick={onClose}
    />
  );
}

export function BookingWrapper({ children }: { children: ReactNode }): ReactNode {
  return (
    <motion.div
      {...wrapperMotion}
      className="fixed inset-0 z-[1401] flex items-center justify-center p-4 pointer-events-none"
      style={{ overscrollBehavior: "contain" }}
    >
      {children}
    </motion.div>
  );
}

export function BookingPanel({
  children,
  className,
  style,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  labelledBy: string;
}): ReactNode {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      layout
      {...panelMotion}
      className={className}
      style={{ transformOrigin: PANEL_ORIGIN, ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}
