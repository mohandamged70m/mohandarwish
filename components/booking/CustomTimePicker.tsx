"use client";
import { useId, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { Clock, X, Plus } from "lucide-react";
import { RevilSelect } from "@/components/ui/revil-select";

interface Props {
  isDark: boolean;
  active: boolean;
  value: string | null;
  onApply: (time: string) => void;
  validate?: (time: string) => string | null;
  onError?: (msg: string) => void;
  isUnavailable?: (time: string) => boolean;
  zIndex?: number;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"];

export default function CustomTimePicker({ isDark, active, value, onApply, validate, onError, isUnavailable, zIndex = 1500 }: Props) {
  const lid = useId();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState("10");
  const [m, setM] = useState("00");
  const [p, setP] = useState("AM");
  const chipRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0, width: 340 });

  const openPicker = () => {
    const el = chipRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      const estH = 320;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const left = Math.max(12, Math.min(cx - width / 2, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(cy - estH / 2, window.innerHeight - estH - 12));
      setAnchor({ top, left, width });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const at = (hh: string, mm: string, pp: string) => `${hh.padStart(2, "0")}:${mm} ${pp}`;
  const gone = (hh: string, mm: string, pp: string) => !!isUnavailable?.(at(hh, mm, pp));
  const hourOpts = HOURS.map((hh) => ({ value: hh, label: hh, disabled: MINUTES.every((mm) => gone(hh, mm, p)) }));
  const minuteOpts = MINUTES.map((mm) => ({ value: mm, label: mm, disabled: gone(h, mm, p) }));
  const periodOpts = PERIODS.map((pp) => ({ value: pp, label: pp, disabled: HOURS.every((hh) => MINUTES.every((mm) => gone(hh, mm, pp))) }));

  if (open && isUnavailable) {
    const firstFree = (o: { value: string; disabled?: boolean }[]) => o.find((x) => !x.disabled)?.value;
    const np = periodOpts.find((o) => o.value === p)?.disabled ? firstFree(periodOpts) : undefined;
    const nh = hourOpts.find((o) => o.value === h)?.disabled ? firstFree(hourOpts) : undefined;
    const nm = minuteOpts.find((o) => o.value === m)?.disabled ? firstFree(minuteOpts) : undefined;
    if (np && np !== p) setP(np);
    else if (nh && nh !== h) setH(nh);
    else if (nm && nm !== m) setM(nm);
  }

  const apply = () => {
    const t = `${h.padStart(2, "0")}:${m} ${p}`;
    const err = validate ? validate(t) : null;
    if (err) { onError?.(err); return; }
    onApply(t);
    setOpen(false);
  };

  const chipActive = active && !!value;

  return (
    <LayoutGroup>
      {open ? (
        <div aria-hidden style={{ visibility: "hidden", padding: "10px 8px", fontSize: "0.75rem", fontWeight: 600 }}>Custom</div>
      ) : (
        <motion.button
          ref={chipRef}
          layoutId={lid}
          type="button"
          onClick={openPicker}
          aria-label="Pick a custom time"
          style={{
            padding: "10px 8px", borderRadius: 12,
            border: `1px dashed ${chipActive ? "var(--accent-primary)" : (isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)")}`,
            background: chipActive ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)" : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
            color: chipActive ? "var(--accent-primary)" : "var(--text-primary)",
            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          {chipActive ? value : (<><Plus size={13} /> Custom</>)}
        </motion.button>
      )}

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                onClick={() => setOpen(false)}
                style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex }}
              />
              <motion.div
                layoutId={lid}
                role="dialog" aria-modal="true" aria-label="Pick a custom time"
                onClick={(e) => e.stopPropagation()}
                transition={{ type: "spring", damping: 30, stiffness: 340, mass: 0.9 }}
                className="glass-panel-deep"
                style={{
                  position: "fixed", top: anchor.top, left: anchor.left, width: anchor.width, zIndex: zIndex + 1,
                  borderRadius: 24, padding: 22, display: "flex", flexDirection: "column", gap: 18,
                  boxShadow: isDark ? "0 30px 80px rgba(0,0,0,0.6)" : "0 30px 80px rgba(0,0,0,0.28)",
                }}
              >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.08, duration: 0.18 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                      <Clock size={18} /> Custom Time
                    </h3>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Close custom time picker" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={17} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="text-xs font-semibold" style={{ color: "var(--text-primary)", fontSize: "0.72rem" }}>Hour</label>
                      <RevilSelect value={h} onChange={setH} isDark={isDark} searchable={false} aria-label="Hour" options={hourOpts} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold" style={{ color: "var(--text-primary)", fontSize: "0.72rem" }}>Minute</label>
                      <RevilSelect value={m} onChange={setM} isDark={isDark} aria-label="Minute" options={minuteOpts} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold" style={{ color: "var(--text-primary)", fontSize: "0.72rem" }}>Period</label>
                      <RevilSelect value={p} onChange={setP} isDark={isDark} aria-label="AM or PM" options={periodOpts} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 14, border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`, background: "transparent", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    <button type="button" onClick={apply} className="btn-primary btn" style={{ flex: 1, padding: 12, borderRadius: 14 }}>Set Time</button>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </LayoutGroup>
  );
}
