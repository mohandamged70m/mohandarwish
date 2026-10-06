"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/* ── Geometry & motion ───────────────────────────────────────────────
   Every size and timing lives here — nothing magic inline. */
const TRACK_PADDING = 5;
const TAB_WIDTH = 140;
const TAB_WIDTH_NARROW = 120;
const NARROW_BREAKPOINT = 420;
const TAB_MIN_HEIGHT = 44;
const TAB_FONT_SIZE = 13;
const STRETCH_DURATION = 0.5;
const STRETCH_EASE: [number, number, number, number] = [0.5, 0, 0.2, 1];
const STRETCH_MIDPOINT = 0.45;
const KNOB_GLOW_COVERAGE = "55%";

export type ProjectsTabItem = { id: string; label: string };

type ProjectsTabsProps = {
  tabs: ProjectsTabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. Defaults to "Sections". */
  ariaLabel?: string;
};

type Frame = { left: number; width: number };

/**
 * Stretch-blob tab switcher. A solid accent knob sits behind the active
 * label; on change it stretches to cover both the old and new tab, then
 * contracts onto the new one (keyframed `left`/`width`, no `layoutId`).
 */
export function ProjectsTabs({
  tabs,
  value,
  onChange,
  ariaLabel = "Sections",
}: ProjectsTabsProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const framesRef = useRef<Frame[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const placedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const activeIndex = tabs.findIndex((t) => t.id === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  // Latest values for listeners that must not re-subscribe on change.
  const activeRef = useRef(safeIndex);
  const reduceRef = useRef(reduceMotion);
  useEffect(() => {
    activeRef.current = safeIndex;
  }, [safeIndex]);
  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  /** Measure every tab against the relative inner container. */
  const measure = useCallback(() => {
    framesRef.current = tabRefs.current.map((el) => ({
      left: el?.offsetLeft ?? 0,
      width: el?.offsetWidth ?? 0,
    }));
  }, []);

  /** Drop the knob onto a tab with no animation. */
  const placeInstant = useCallback((index: number) => {
    const knob = knobRef.current;
    const to = framesRef.current[index];
    if (!knob || !to || to.width === 0) return;
    stopRef.current?.();
    stopRef.current = null;
    knob.style.left = `${to.left}px`;
    knob.style.width = `${to.width}px`;
    knob.style.opacity = "1";
  }, []);

  /** Liquid stretch from the knob's *current* position to a tab. */
  const stretchTo = useCallback(
    (index: number) => {
      const knob = knobRef.current;
      const inner = innerRef.current;
      const to = framesRef.current[index];
      if (!knob || !inner || !to || to.width === 0) return;
      if (reduceRef.current) {
        placeInstant(index);
        return;
      }
      // Stop the in-flight stretch; read the live rect so rapid clicks
      // continue from exactly where the knob is, with no jump.
      stopRef.current?.();
      stopRef.current = null;
      const innerBox = inner.getBoundingClientRect();
      const knobBox = knob.getBoundingClientRect();
      const fromLeft = knobBox.left - innerBox.left;
      const fromWidth = knobBox.width;
      const settled =
        Math.abs(fromLeft - to.left) < 0.5 &&
        Math.abs(fromWidth - to.width) < 0.5;
      if (settled) {
        placeInstant(index);
        return;
      }
      const midLeft = Math.min(fromLeft, to.left);
      const span =
        Math.max(fromLeft + fromWidth, to.left + to.width) - midLeft;
      knob.style.opacity = "1";
      const controls = animate(
        knob,
        {
          left: [fromLeft, midLeft, to.left],
          width: [fromWidth, span, to.width],
        },
        {
          duration: STRETCH_DURATION,
          ease: STRETCH_EASE,
          times: [0, STRETCH_MIDPOINT, 1],
        }
      );
      stopRef.current = () => controls.stop();
    },
    [placeInstant]
  );

  // First paint: measure and seat the knob instantly, never animated.
  useLayoutEffect(() => {
    measure();
    placeInstant(activeRef.current);
    placedRef.current = true;
  }, [measure, placeInstant]);

  // Tab set changed (labels/widths): re-measure and re-seat, no animation.
  const tabsKey = tabs.map((t) => `${t.id}:${t.label}`).join("|");
  useLayoutEffect(() => {
    if (!placedRef.current) return;
    measure();
    placeInstant(activeRef.current);
  }, [tabsKey, measure, placeInstant]);

  // Resize + font load: re-measure and re-seat instantly so the knob
  // never lands in the wrong place.
  useEffect(() => {
    const reseat = () => {
      measure();
      placeInstant(activeRef.current);
    };
    window.addEventListener("resize", reseat);
    let cancelled = false;
    try {
      void document.fonts?.ready.then(() => {
        if (!cancelled) reseat();
      });
    } catch {
      /* fonts API unavailable — resize listener still covers us */
    }
    return () => {
      cancelled = true;
      window.removeEventListener("resize", reseat);
    };
  }, [measure, placeInstant]);

  // Controlled value change → stretch (skips the mount pass, which the
  // layout effect above already seated).
  const isFirstValue = useRef(true);
  useEffect(() => {
    if (isFirstValue.current) {
      isFirstValue.current = false;
      return;
    }
    stretchTo(safeIndex);
  }, [safeIndex, stretchTo]);

  useEffect(
    () => () => {
      stopRef.current?.();
    },
    []
  );

  const selectIndex = (next: number) => {
    tabRefs.current[next]?.focus();
    const id = tabs[next]?.id;
    if (id !== undefined && id !== value) onChange(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    e.preventDefault();
    const count = tabs.length;
    if (count === 0) return;
    if (e.key === "ArrowRight") selectIndex((safeIndex + 1) % count);
    else if (e.key === "ArrowLeft")
      selectIndex((safeIndex - 1 + count) % count);
    else if (e.key === "Home") selectIndex(0);
    else selectIndex(count - 1);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="inline-flex rounded-full border border-border bg-bg-surface shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-neutral-950 dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)]"
      style={{ padding: TRACK_PADDING }}
    >
      <div ref={innerRef} className="relative flex">
        <div
          ref={knobRef}
          aria-hidden
          className="absolute top-0 bottom-0 left-0 rounded-full opacity-0"
          style={{
            width: 0,
            background: "var(--accent)",
            boxShadow: `0 0 24px color-mix(in srgb, var(--accent) ${KNOB_GLOW_COVERAGE}, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
          }}
        />
        {tabs.map((tab, i) => {
          const selected = i === safeIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                if (tab.id !== value) onChange(tab.id);
              }}
              className={`projects-tabs-tab relative z-10 flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent font-mono font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                selected
                  ? "text-text-on-accent"
                  : "text-text-secondary/60 hover:text-text-primary"
              }`}
              style={{
                width: TAB_WIDTH,
                minHeight: TAB_MIN_HEIGHT,
                fontSize: TAB_FONT_SIZE,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <style>{`@media (max-width: ${NARROW_BREAKPOINT}px) {
  .projects-tabs-tab {
    width: ${TAB_WIDTH_NARROW}px !important;
  }
}`}</style>
    </div>
  );
}
