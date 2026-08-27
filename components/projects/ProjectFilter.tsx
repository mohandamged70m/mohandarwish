"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECTS, type FilterCategory } from "@/Data/projects";

type Props = {
  categories: readonly FilterCategory[];
  active: FilterCategory;
  onChange: (c: FilterCategory) => void;
  counts?: Record<FilterCategory, number>;
};

const defaultCounts: Record<FilterCategory, number> = {
  "Best Works": PROJECTS.filter((p) => p.featured).length,
  Frontend: PROJECTS.filter((p) => p.category === "Frontend").length,
  "Full-Stack": PROJECTS.filter((p) => p.category === "Full-Stack").length,
  "Design System": PROJECTS.filter((p) => p.category === "Design System").length,
  Tooling: PROJECTS.filter((p) => p.category === "Tooling").length,
};

export function ProjectFilter({ categories, active, onChange, counts = defaultCounts }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);
  const activeIdx = categories.indexOf(active);

  const measure = useCallback(() => {
    const track = listRef.current;
    const el = activeIdx >= 0 ? btnRefs.current[activeIdx] : null;
    if (!track || !el) {
      setPill(null);
      return;
    }
    // account for track scroll offset — prevents pill drift when filter overflows
    const tr = track.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ x: r.left - tr.left + track.scrollLeft, w: r.width });
  }, [activeIdx]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    btnRefs.current.forEach((el) => el && ro.observe(el));
    const track = listRef.current;
    track?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      track?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  useEffect(() => {
    if (!pill) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [pill]);

  // keep active tab visible when filter changes or overflows
  useEffect(() => {
    const el = activeIdx >= 0 ? btnRefs.current[activeIdx] : null;
    if (!el) return;
    // scroll into view centered, smooth unless reduced motion
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: prefersReduced ? "instant" as ScrollBehavior : "smooth",
      inline: "center",
      block: "nearest",
    });
    // re-measure after scroll
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [activeIdx, measure]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let next = activeIdx;
    if (e.key === "ArrowRight") next = (activeIdx + 1) % categories.length;
    else if (e.key === "ArrowLeft") next = (activeIdx - 1 + categories.length) % categories.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = categories.length - 1;
    btnRefs.current[next]?.focus();
    onChange(categories[next]!);
  };

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="inline-flex max-w-[calc(100vw-2rem)] sm:max-w-full items-center gap-2 rounded-full bg-bg-surface border border-border p-1.5 shadow-sm overflow-hidden"
      role="tablist"
      aria-label="Project categories"
      onKeyDown={onKeyDown}
    >
      <div
        ref={listRef}
        data-lenis-prevent
        className="relative flex items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory [scroll-padding-inline:8px]"
      >
        {pill && (
          <motion.span
            aria-hidden
            initial={false}
            animate={{ x: pill.x, width: pill.w }}
            transition={
              ready && !prefersReduced
                ? { type: "spring", stiffness: 380, damping: 32 }
                : { duration: 0 }
            }
            className="absolute inset-y-0 left-0 rounded-full bg-accent shadow-[0_0_20px_var(--accent-ring)] will-change-transform"
            style={{ top: 0, bottom: 0 }}
          />
        )}
        {categories.map((cat, i) => {
          const isActive = cat === active;
          const count = counts[cat];
          return (
            <button
              key={cat}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(cat)}
              className={`relative z-10 inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-[13px] sm:text-sm font-heading font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap
                ${isActive ? "text-text-on-accent" : "text-text-secondary hover:text-text-primary"}`}
            >
              {cat}
              {typeof count === "number" && (
                <span
                  aria-hidden
                  className={`inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold transition-colors ${
                    isActive ? "bg-text-on-accent/15 text-text-on-accent" : "bg-bg-primary border border-border text-text-muted"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
