/* eslint-disable react-hooks/set-state-in-effect -- keeping the picker in sync with the controlled value */
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

interface Props {
  className?: string;
  style?: CSSProperties;
  isDark?: boolean;
  active?: boolean;
  /** "hh:mm AM/PM" on the host clock. */
  value?: string | null;
  zIndex?: number;
  validate?: (time: string) => string | null;
  onError?: (message: string) => void;
  onApply: (time: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"];

function parts(value: string | null | undefined): [string, string, string] {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((value || "").trim());
  if (!match) return ["10", "00", "AM"];
  const rawHour = Number(match[1]) % 12;
  return [String(rawHour === 0 ? 12 : rawHour), match[2], match[3].toUpperCase()];
}

export default function CustomTimePicker({
  className = "",
  style,
  active,
  value,
  zIndex = 2100,
  validate,
  onError,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => parts(value)[0]);
  const [minute, setMinute] = useState(() => parts(value)[1]);
  const [period, setPeriod] = useState(() => parts(value)[2]);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 300 });

  useEffect(() => {
    const [h, m, p] = parts(value);
    setHour(h);
    setMinute(m);
    setPeriod(p);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const toggle = () => {
    const el = chipRef.current;
    if (el && typeof window !== "undefined") {
      const rect = el.getBoundingClientRect();
      const width = Math.min(300, window.innerWidth - 24);
      setAnchor({
        top: Math.min(window.innerHeight - 300, rect.bottom + 6),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    }
    setOpen((wasOpen) => !wasOpen);
  };

  const apply = () => {
    const time = `${hour.padStart(2, "0")}:${minute} ${period}`;
    const error = validate?.(time) ?? null;
    if (error) {
      onError?.(error);
      return;
    }
    onApply(time);
    setOpen(false);
  };

  const controlStyle: CSSProperties = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "6px 8px",
  };
  const buttonStyle: CSSProperties = {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 4,
    cursor: "pointer",
    color: "var(--text-primary)",
  };
  const panelStyle: CSSProperties = {
    position: "fixed",
    top: Math.max(12, anchor.top),
    left: anchor.left,
    width: anchor.width,
    zIndex: zIndex + 1,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  return (
    <>
      <button ref={chipRef} type="button" onClick={toggle} className={className} style={style} aria-label="Pick a custom time">
        {active && value ? value : "Custom"}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex }} />
          <div role="dialog" aria-label="Pick a custom time" style={panelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <select aria-label="Hour" value={hour} onChange={(event) => setHour(event.target.value)} style={controlStyle}>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select aria-label="Minute" value={minute} onChange={(event) => setMinute(event.target.value)} style={controlStyle}>
                {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select aria-label="AM or PM" value={period} onChange={(event) => setPeriod(event.target.value)} style={controlStyle}>
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ ...buttonStyle, border: "1px solid var(--border)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                style={{ ...buttonStyle, border: "1px solid var(--accent-primary)", background: "var(--accent-primary)" }}
              >
                Set time
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
