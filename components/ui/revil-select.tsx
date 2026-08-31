"use client";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SelectOption { value: string; label: string; hint?: string; disabled?: boolean; }

interface Props {
  value: string;
  options: Array<SelectOption | string>;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  isDark?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const normalize = (o: SelectOption | string): SelectOption => typeof o === "string" ? { value: o, label: o } : o;
const GAP = 6;

function useAutoDark(forced?: boolean): boolean {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    if (forced !== undefined || typeof document === "undefined") return;
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [forced]);
  return forced ?? dark;
}

export function RevilSelect({ value, options, onChange, placeholder = "Select…", searchable, isDark: forcedDark, disabled = false, className = "", "aria-label": ariaLabel }: Props) {
  const isDark = useAutoDark(forcedDark);
  const opts = useMemo(() => options.map(normalize), [options]);
  const selected = opts.find((o) => o.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280, flipUp: false, triggerH: 40, menuH: 0 });

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.max(200, Math.min(r.width, vw - 16));
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const h = popRef.current?.offsetHeight || 0;
    const below = vh - r.bottom;
    const flipUp = h > 0 && below < h + GAP && r.top > below;
    const top = flipUp ? Math.max(8, r.top - GAP - h) : r.bottom + GAP;
    setPos({ top, left, width, flipUp, triggerH: r.height, menuH: h });
  }, []);

  const grow = pos.menuH ? pos.triggerH / pos.menuH : 0.3;
  const shift = pos.triggerH + GAP;
  const entry = {
    initial: { opacity: 0, scaleY: grow, y: pos.flipUp ? shift : -shift },
    animate: { opacity: 1, scaleY: 1, y: 0 },
    exit: { opacity: 0, scaleY: grow, y: pos.flipUp ? shift : -shift },
  };

  useEffect(() => {
    if (!open) return;
    const c = listRef.current, el = selectedRef.current;
    if (c && el) c.scrollTo({ top: el.offsetTop - (c.clientHeight - el.offsetHeight) / 2, behavior: "instant" });
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    const onScroll = () => updatePos();
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  const showSearch = (searchable ?? opts.length > 8) && opts.length > 8;
  const filtered = query ? opts.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : opts;
  const triggerCls = `w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors outline-none ${isDark ? "bg-white/5 border-white/10 hover:border-white/20" : "bg-black/[0.03] border-black/10 hover:border-black/20"} ${open ? "border-accent/60" : ""} ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`;

  return (
    <>
      <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (disabled) return; setQuery(""); if (!open) updatePos(); setOpen((o) => !o); }} className={triggerCls} title={selected?.label || placeholder}>
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={16} className={`text-[var(--text-muted)] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="select-pop" ref={popRef} role="listbox"
              initial={entry.initial} animate={entry.animate} exit={entry.exit}
              transition={{ default: { type: "spring", stiffness: 560, damping: 38, mass: 0.7 }, opacity: { duration: 0.12 } }}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 10000, transformOrigin: pos.flipUp ? "bottom center" : "top center" }}
              className={`rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${isDark ? "bg-[#15151c]/80 border-white/10" : "bg-white/80 border-black/10"}`}
            >
              {showSearch && (
                <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
                  <Search size={14} className="text-[var(--text-muted)]" />
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                </div>
              )}
              <div ref={listRef} className="relative max-h-[260px] overflow-y-auto p-1.5 flex flex-col gap-0.5" style={{ scrollbarWidth: "thin" }}>
                {filtered.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[var(--text-muted)] text-sm">No matches</div>
                ) : filtered.map((o) => (
                  <button key={o.value} ref={o.value === value ? selectedRef : undefined} type="button" role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined} disabled={o.disabled} onClick={() => { if (o.disabled) return; onChange(o.value); setOpen(false); }} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${o.disabled ? "text-[var(--text-muted)] opacity-40 cursor-not-allowed line-through" : o.value === value ? "bg-accent/15 text-accent font-semibold" : "text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10"}`}>
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="text-[var(--text-muted)] text-xs flex-shrink-0">{o.hint}</span>}
                    {!o.disabled && o.value === value && <Check size={15} className="flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
export default RevilSelect;
