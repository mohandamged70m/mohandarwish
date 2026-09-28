"use client";

import type { ReactNode } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  startingValue?: number;
  maxValue?: number;
  isStepped?: boolean;
  stepSize?: number;
  suffix?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  "aria-label"?: string;
}

export default function ElasticSlider({
  value,
  onChange,
  startingValue = 0,
  maxValue = 100,
  isStepped,
  stepSize = 1,
  suffix = "",
  leftIcon,
  rightIcon,
  "aria-label": ariaLabel,
}: Props) {
  const pct = maxValue > startingValue ? ((value - startingValue) / (maxValue - startingValue)) * 100 : 0;
  return (
    <span className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
      {leftIcon}
      <input
        type="range"
        aria-label={ariaLabel}
        min={startingValue}
        max={maxValue}
        step={isStepped ? stepSize : "any"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 cursor-pointer"
        style={{ accentColor: "var(--accent)" }}
      />
      {rightIcon}
      <span
        className="text-sm font-bold tabular-nums"
        style={{
          minWidth: 64,
          textAlign: "right",
          color: "var(--text-primary)",
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          borderRadius: 8,
          padding: "4px 8px",
        }}
      >
        {Math.round(value)}
        {suffix}
      </span>
      <style>{`/* pct:${Math.round(Math.max(0, Math.min(100, pct)))} */`}</style>
    </span>
  );
}
