"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  portal?: boolean;
  text?: string;
  children?: ReactNode;
  className?: string;
}

/** Covers the panel (or the page, with `portal`) while a save/load is in flight. */
export default function LoadingCurtain({ open, portal, text = "Loading…", children, className = "" }: Props) {
  if (!open) return null;

  const curtain = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`${portal ? "fixed" : "absolute"} inset-0 z-[200] flex flex-col items-center justify-center gap-3 font-body ${className}`}
      style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}
    >
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-primary)" }}
      />
      <span className="text-sm">{children ?? text}</span>
    </div>
  );

  if (portal && typeof document !== "undefined") return createPortal(curtain, document.body);
  return curtain;
}
