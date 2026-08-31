"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/Data/projects";
import { ProjectCard } from "./ProjectCard";

type Props = {
  projects: readonly Project[];
  active?: string;
  sectionRef?: React.RefObject<HTMLElement | null>;
};

export function ProjectsCarousel({ projects, active }: Props) {
  const visible = projects;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const isSmoothScrolling = useRef(false);
  const smoothTimer = useRef<number | null>(null);
  const wheelEndTimer = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // prefers-reduced-motion — ui-ux: reduced-motion, no-blocking-animation
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReduced(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

  // ---------- scroll state — interruptible, no blocking, main-thread-budget ----------
  // use refs to avoid stale deps causing missed updates (main-thread-budget)
  const canLeftRef = useRef(canLeft);
  const canRightRef = useRef(canRight);
  const progressRef = useRef(progress);
  useEffect(() => {
    canLeftRef.current = canLeft;
    canRightRef.current = canRight;
    progressRef.current = progress;
  }, [canLeft, canRight, progress]);
  const updateScrollState = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth + 4) {
      if (canLeftRef.current || canRightRef.current || progressRef.current !== 0) {
        setCanLeft(false);
        setCanRight(false);
        setProgress(0);
      }
      return;
    }
    const nextCanLeft = scrollLeft > 8;
    const nextCanRight = scrollLeft + clientWidth < scrollWidth - 8;
    const nextProgress = scrollLeft / (scrollWidth - clientWidth);
    if (nextCanLeft !== canLeftRef.current) setCanLeft(nextCanLeft);
    if (nextCanRight !== canRightRef.current) setCanRight(nextCanRight);
    if (Math.abs(nextProgress - progressRef.current) > 0.005) setProgress(nextProgress);
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafId.current) return;
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;
      updateScrollState();
    });
  }, [updateScrollState]);

  const flushSmooth = useCallback(() => {
    isSmoothScrolling.current = false;
    if (smoothTimer.current) {
      window.clearTimeout(smoothTimer.current);
      smoothTimer.current = null;
    }
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    updateScrollState();
    const onScroll = () => scheduleUpdate();
    // scrollend is best-effort; fallback timer also clears lock
    const onScrollEnd = () => flushSmooth();
    el.addEventListener("scroll", onScroll, { passive: true });
    (el as unknown as { addEventListener: (a: string, b: EventListener) => void }).addEventListener(
      "scrollend",
      onScrollEnd as EventListener
    );
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      el.removeEventListener("scroll", onScroll);
      (el as unknown as { removeEventListener: (a: string, b: EventListener) => void }).removeEventListener(
        "scrollend",
        onScrollEnd as EventListener
      );
      window.removeEventListener("resize", scheduleUpdate);
      ro.disconnect();
      if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
      if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [visible.length, scheduleUpdate, flushSmooth, updateScrollState]);

  // reset on filter change — cancellable-state-transitions, focus-management
  const prevActive = useRef(active);
  const prevLen = useRef(visible.length);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (prevActive.current !== active || prevLen.current !== visible.length) {
      prevActive.current = active;
      prevLen.current = visible.length;
      isSmoothScrolling.current = false;
      if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
      if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
      requestAnimationFrame(() => {
        el.scrollTo({ left: 0, behavior: "auto" });
        requestAnimationFrame(updateScrollState);
      });
    }
  }, [active, visible.length, updateScrollState]);

  useEffect(() => {
    const id = window.setTimeout(() => updateScrollState(), 80);
    return () => window.clearTimeout(id);
  }, [visible.length, active, updateScrollState]);

  // reset to first when carousel leaves viewport — fixes down->up->down staying at last project
  useEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    let wasIntersecting = true;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isVisible = entry.isIntersecting;
        // only reset when we *leave* viewport, not on mount
        if (wasIntersecting && !isVisible) {
          isSmoothScrolling.current = false;
          if (smoothTimer.current) {
            window.clearTimeout(smoothTimer.current);
            smoothTimer.current = null;
          }
          if (wheelEndTimer.current) {
            window.clearTimeout(wheelEndTimer.current);
            wheelEndTimer.current = null;
          }
          viewport.scrollTo({ left: 0, behavior: "auto" });
          requestAnimationFrame(() => updateScrollState());
        }
        wasIntersecting = isVisible;
      },
      { threshold: 0 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [updateScrollState]);

  // ---------- helpers: offset-based (actual card positions), not equal distribution ----------
  const getNearestIndex = useCallback(() => {
    const el = viewportRef.current;
    const track = trackRef.current;
    if (!el || !track || visible.length <= 1) return 0;
    const children = Array.from(track.children) as HTMLElement[];
    if (children.length === 0) return 0;
    // distance of each card start to viewport scrollLeft
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      // offsetLeft is relative to track's offsetParent; track is w-max inside viewport, so diff is scroll + padding
      const childLeft = child.offsetLeft;
      const dist = Math.abs(childLeft - el.scrollLeft);
      // also consider viewport visible center bias: prefer snap that keeps card fully in view when near
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }, [visible.length]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = viewportRef.current;
      const track = trackRef.current;
      if (!el || !track) return;
      const clamped = Math.max(0, Math.min(visible.length - 1, index));
      const children = Array.from(track.children) as HTMLElement[];
      const targetEl = children[clamped];
      const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
      if (targetEl) {
        // interruptible — cancel prior smooth
        isSmoothScrolling.current = false;
        if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
        if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
        // compute dest via offsetLeft (stable) not getBoundingClientRect
        const dest = targetEl.offsetLeft;
        if (!prefersReduced) {
          isSmoothScrolling.current = true;
          smoothTimer.current = window.setTimeout(flushSmooth, 700);
        }
        el.scrollTo({ left: dest, behavior });
        return;
      }
      // fallback
      const fallback = (el.scrollWidth - el.clientWidth) * (visible.length <= 1 ? 0 : clamped / (visible.length - 1));
      if (!prefersReduced) {
        isSmoothScrolling.current = true;
        smoothTimer.current = window.setTimeout(flushSmooth, 700);
      }
      el.scrollTo({ left: fallback, behavior });
    },
    [flushSmooth, prefersReduced, visible.length]
  );

  const scrollBy = useCallback(
    (dir: 1 | -1) => {
      const current = getNearestIndex();
      scrollToIndex(current + dir);
    },
    [getNearestIndex, scrollToIndex]
  );

  const snapToNearest = useCallback(() => {
    if (prefersReduced) return;
    if (isSmoothScrolling.current) return;
    const el = viewportRef.current;
    if (!el || visible.length <= 1) return;
    const total = el.scrollWidth - el.clientWidth;
    if (total <= 4) return;
    const idx = getNearestIndex();
    const children = Array.from(trackRef.current?.children ?? []) as HTMLElement[];
    const target = children[idx];
    if (!target) return;
    const dest = target.offsetLeft;
    if (Math.abs(el.scrollLeft - dest) < 4) return;
    isSmoothScrolling.current = true;
    if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
    smoothTimer.current = window.setTimeout(flushSmooth, 500);
    el.scrollTo({ left: dest, behavior: "smooth" });
  }, [flushSmooth, getNearestIndex, prefersReduced, visible.length]);

  // drag disabled — user wants scroll/wheel only, no left-click drag to move carousel

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBy(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBy(1);
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollToIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      scrollToIndex(visible.length - 1);
    }
  };

  // wheel: vertical scroll → horizontal scroll (spec) without hijacking page
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 4) return;
    let deltaX = e.deltaX;
    let deltaY = e.deltaY;
    if (e.deltaMode === 1) {
      deltaX *= 16;
      deltaY *= 16;
    } else if (e.deltaMode === 2) {
      deltaX *= el.clientWidth;
      deltaY *= el.clientHeight;
    }
    // scroll down → scroll right; scroll up now skips horizontal and lets page go up
    const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) || e.shiftKey;
    let delta: number;
    if (isHorizontalIntent) {
      delta = e.shiftKey && Math.abs(deltaX) < 2 ? deltaY : deltaX || deltaY;
    } else {
      delta = deltaY;
    }
    if (Math.abs(delta) < 1) return;
    // user requested: scroll up skips horizontal (goes to previous section)
    if (!isHorizontalIntent && delta < 0) return;
    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    if (delta > 0 && atRight) return;
    if (!isHorizontalIntent && delta < 0 && atLeft) return;
    isSmoothScrolling.current = false;
    if (smoothTimer.current) {
      window.clearTimeout(smoothTimer.current);
      smoothTimer.current = null;
    }
    if (wheelEndTimer.current) {
      window.clearTimeout(wheelEndTimer.current);
      wheelEndTimer.current = null;
    }
    e.preventDefault();
    el.scrollBy({ left: delta, behavior: "auto" });
    scheduleUpdate();
  };

  const hasOverflow = visible.length > 1;
  // active index for dots/progress derived from nearest card (not fractional progress)
  const activeIdx = getNearestIndex();
  // progress for bar still fractional for smooth visual
  const barProgress = (() => {
    const el = viewportRef.current;
    if (!el || visible.length <= 1) return progress;
    return progress;
  })();

  return (
    <div ref={rootRef} className="carousel-root relative w-full max-w-full min-w-0 overflow-hidden isolate [contain:layout_paint]">
      {/* edge fade affordances — subtle, palette-matched */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-20 bg-gradient-to-r from-bg-primary via-bg-primary/80 to-transparent transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-20 bg-gradient-to-l from-bg-primary via-bg-primary/80 to-transparent transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`}
      />

      {/* arrows — dragging-alternative, touch-target 44px */}
      <button
        type="button"
        aria-label="Scroll projects left"
        tabIndex={canLeft ? 0 : -1}
        onClick={() => scrollBy(-1)}
        disabled={!canLeft}
        aria-disabled={!canLeft}
        className={`carousel-arrow absolute left-[max(8px,env(safe-area-inset-left))] sm:left-[max(16px,env(safe-area-inset-left))] lg:left-[max(24px,env(safe-area-inset-left))] top-[38%] z-20 -translate-y-1/2 hidden md:inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl focus-ring transition-all duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
          ${canLeft ? "bg-bg-surface/80 border-border text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100 dark:bg-white/10 dark:border-white/10 dark:text-white dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Scroll projects right"
        tabIndex={canRight ? 0 : -1}
        onClick={() => scrollBy(1)}
        disabled={!canRight}
        aria-disabled={!canRight}
        className={`carousel-arrow absolute right-[max(8px,env(safe-area-inset-right))] sm:right-[max(16px,env(safe-area-inset-right))] lg:right-[max(24px,env(safe-area-inset-right))] top-[38%] z-20 -translate-y-1/2 hidden md:inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl focus-ring transition-all duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
          ${canRight ? "bg-bg-surface/80 border-border text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100 dark:bg-white/10 dark:border-white/10 dark:text-white dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* viewport — drag disabled, scroll/wheel + arrows only */}
      <div
        ref={viewportRef}
        data-lenis-prevent
        role="region"
        aria-label="Project carousel"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        style={{ scrollSnapType: "none" }}
        className={`carousel-viewport block w-full max-w-full min-w-0 box-border overflow-x-auto overflow-y-hidden overscroll-x-auto overscroll-behavior-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 py-2 [touch-action:pan-x] [overscroll-behavior-inline:none] [scroll-behavior:auto]`}
      >
        <div ref={trackRef} className="flex w-max max-w-none items-start gap-4 sm:gap-6 lg:gap-8">
          {visible.map((project) => {
            const featured = active === "Best Works" && project.featured;
            return (
              <div
                key={project.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${project.title} — ${project.category} — slide ${visible.indexOf(project) + 1} of ${visible.length}`}
                className="shrink-0"
              >
                <ProjectCard project={project} featured={featured} />
              </div>
            );
          })}
        </div>
      </div>

      {hasOverflow && (
        <div className="mx-auto mt-6 flex w-full max-w-xl flex-col items-center gap-3 px-6">
          <div
            role="progressbar"
            aria-valuenow={Math.round(barProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carousel progress"
            className="relative h-1 w-full overflow-hidden rounded-pill bg-border"
          >
            <div
              className="absolute inset-y-0 left-0 w-full origin-left rounded-pill bg-accent will-change-transform"
              style={{
                transform: `scaleX(${barProgress})`,
                transition: prefersReduced ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
              }}
              aria-hidden
            />
          </div>
          <div className="flex justify-center gap-1.5" role="group" aria-label="Project navigation">
            {visible.map((_, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to project ${i + 1} of ${visible.length}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => scrollToIndex(i)}
                  className={`h-1.5 rounded-pill transition-all duration-300 focus-ring outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isActive ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-text-muted"}`}
                />
              );
            })}
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            Project {activeIdx + 1} of {visible.length}
            {active ? ` — ${active}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
