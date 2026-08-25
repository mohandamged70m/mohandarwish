"use client";

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PROJECTS, type FilterCategory } from "@/Data/projects";

type Props = {
  categories: readonly FilterCategory[];
  active: FilterCategory;
  onChange: (c: FilterCategory) => void;
  counts?: Record<FilterCategory, number>;
};

const defaultCounts: Record<FilterCategory, number> = {
  "Best Works": PROJECTS.length,
  "App UI": PROJECTS.filter((p) => p.category === "App UI").length,
  "Web UI": PROJECTS.filter((p) => p.category === "Web UI").length,
  "Desktop App UI": PROJECTS.filter((p) => p.category === "Desktop App UI").length,
};

export function ProjectFilter({ categories, active, onChange, counts = defaultCounts }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);
  const activeIdx = categories.indexOf(active);

  const measure = () => {
    const track = listRef.current;
    const el = activeIdx >= 0 ? btnRefs.current[activeIdx] : null;
    if (!track || !el) {
      setPill(null);
      return;
    }
    const tr = track.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ x: r.left - tr.left, w: r.width });
  };

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, active]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    btnRefs.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!pill) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [pill]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (activeIdx + dir + categories.length) % categories.length;
    btnRefs.current[next]?.focus();
    onChange(categories[next]!);
  };

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full bg-bg-surface border border-border p-1.5 shadow-sm"
      role="tablist"
      aria-label="Project categories"
      onKeyDown={onKeyDown}
    >
      <div ref={listRef} className="relative flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className="absolute inset-y-0 left-0 rounded-full bg-accent shadow-[0_0_20px_var(--accent-ring)]"
            style={{ top: 0, bottom: 0 }}
          />
        )}
        {categories.map((cat, i) => {
          const isActive = cat === active;
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
              className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-[13px] sm:text-sm font-heading font-medium transition-colors duration-200 cursor-pointer focus-ring whitespace-nowrap outline-none
                ${isActive ? "text-text-on-accent" : "text-text-secondary hover:text-text-primary"}`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
