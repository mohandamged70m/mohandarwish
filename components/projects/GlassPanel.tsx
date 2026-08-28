"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function GlassPanel({ children, className = "", style }: Props) {
  return (
    <div
      className={`border ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: "32px",
        borderColor: "rgba(255, 255, 255, 0.08)",
        padding: "30px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
