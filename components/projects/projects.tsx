"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FILTER_CATEGORIES, PROJECTS } from "@/Data/projects";
import type { FilterCategory } from "@/Data/projects";
import { ProjectFilter } from "./ProjectFilter";
import { ProjectCard } from "./ProjectCard";
import type { ReactNode } from "react";

export function Projects(): ReactNode {
  const [active, setActive] = useState<FilterCategory>("Best Works");

  const filtered = (() => {
    if (active === "Best Works") return [...PROJECTS];
    return PROJECTS.filter((p) => p.category === active);
  })();

  const counts: Record<FilterCategory, number> = {
    "Best Works": PROJECTS.length,
    Frontend: PROJECTS.filter((p) => p.category === "Frontend").length,
    "Full-Stack": PROJECTS.filter((p) => p.category === "Full-Stack").length,
    "Design System": PROJECTS.filter((p) => p.category === "Design System").length,
    Tooling: PROJECTS.filter((p) => p.category === "Tooling").length,
  };

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const draggedRecently = useRef(false);
  const isSmoothScrolling = useRef(false);
  const smoothTimer = useRef<number | null>(null);
  const wheelEndTimer = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReduced(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);

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
  }, [filtered.length, scheduleUpdate, flushSmooth, updateScrollState]);

  const prevActive = useRef(active);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (prevActive.current !== active) {
      prevActive.current = active;
      isSmoothScrolling.current = false;
      if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
      if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
      requestAnimationFrame(() => {
        el.scrollTo({ left: 0, behavior: "auto" });
        requestAnimationFrame(updateScrollState);
      });
    }
  }, [active, updateScrollState]);

  useEffect(() => {
    const id = window.setTimeout(() => updateScrollState(), 80);
    return () => window.clearTimeout(id);
  }, [filtered.length, active, updateScrollState]);

  const getNearestIndex = useCallback(() => {
    const el = viewportRef.current;
    const track = trackRef.current;
    if (!el || !track || filtered.length <= 1) return 0;
    const children = Array.from(track.children) as HTMLElement[];
    if (children.length === 0) return 0;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      const dist = Math.abs(children[i]!.offsetLeft - el.scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }, [filtered.length]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = viewportRef.current;
      const track = trackRef.current;
      if (!el || !track) return;
      const clamped = Math.max(0, Math.min(filtered.length - 1, index));
      const children = Array.from(track.children) as HTMLElement[];
      const targetEl = children[clamped];
      const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
      if (targetEl) {
        isSmoothScrolling.current = false;
        if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
        if (wheelEndTimer.current) window.clearTimeout(wheelEndTimer.current);
        const dest = targetEl.offsetLeft;
        if (!prefersReduced) {
          isSmoothScrolling.current = true;
          smoothTimer.current = window.setTimeout(flushSmooth, 700);
        }
        el.scrollTo({ left: dest, behavior });
        return;
      }
      const fallback = (el.scrollWidth - el.clientWidth) * (filtered.length <= 1 ? 0 : clamped / (filtered.length - 1));
      if (!prefersReduced) {
        isSmoothScrolling.current = true;
        smoothTimer.current = window.setTimeout(flushSmooth, 700);
      }
      el.scrollTo({ left: fallback, behavior });
    },
    [filtered.length, flushSmooth, prefersReduced]
  );

  const scrollBy = useCallback(
    (dir: 1 | -1) => {
      scrollToIndex(getNearestIndex() + dir);
    },
    [getNearestIndex, scrollToIndex]
  );

  const snapToNearest = useCallback(() => {
    if (prefersReduced) return;
    if (isSmoothScrolling.current) return;
    if (isDragging.current) return;
    const el = viewportRef.current;
    if (!el || filtered.length <= 1) return;
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
  }, [filtered.length, flushSmooth, getNearestIndex, prefersReduced]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = viewportRef.current;
    if (!el) return;
    isDragging.current = false;
    draggedRecently.current = false;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
    isSmoothScrolling.current = false;
    if (smoothTimer.current) {
      window.clearTimeout(smoothTimer.current);
      smoothTimer.current = null;
    }
    if (wheelEndTimer.current) {
      window.clearTimeout(wheelEndTimer.current);
      wheelEndTimer.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = viewportRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    if (!isDragging.current) {
      if (Math.abs(dx) < 8) return;
      isDragging.current = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
    }
    el.scrollLeft = scrollStart.current - dx;
  };
  const stopDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = viewportRef.current;
    if (!el) return;
    const wasDragging = isDragging.current;
    if (wasDragging) {
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {}
      draggedRecently.current = true;
      window.setTimeout(() => {
        draggedRecently.current = false;
      }, 220);
      requestAnimationFrame(() => {
        scheduleUpdate();
        window.setTimeout(snapToNearest, 40);
      });
    }
    isDragging.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
    if (wasDragging) scheduleUpdate();
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggedRecently.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

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
      scrollToIndex(filtered.length - 1);
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
    const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) || e.shiftKey;
    let delta: number;
    if (isHorizontalIntent) {
      delta = e.shiftKey && Math.abs(deltaX) < 2 ? deltaY : deltaX || deltaY;
    } else {
      delta = deltaY;
    }
    if (Math.abs(delta) < 1) return;
    if (!isHorizontalIntent && delta < 0) return; // scroll up skips horizontal
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

  const hasOverflow = filtered.length > 1;
  const activeIdx = getNearestIndex();

  return (
    <section
      aria-label="All projects"
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12 overflow-hidden"
    >
      <div className="flex w-full flex-col items-center gap-8">
        <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={counts} />
        <p className="sr-only" aria-live="polite">
          Showing {filtered.length} projects for {active}
        </p>

        {filtered.length === 0 ? (
          <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
            <p className="font-heading text-sm font-medium text-text-primary">No projects in {active} — try Best Works</p>
            <p className="font-body text-sm text-text-muted mt-1">Switch filter to see featured projects.</p>
          </div>
        ) : (
          <div className="relative w-full max-w-full min-w-0 overflow-hidden isolate [contain:layout_paint]">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-16 bg-gradient-to-r from-bg-primary via-bg-primary/80 to-transparent transition-opacity duration-200 ${canLeft ? "opacity-100" : "opacity-0"}`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-16 bg-gradient-to-l from-bg-primary via-bg-primary/80 to-transparent transition-opacity duration-200 ${canRight ? "opacity-100" : "opacity-0"}`}
            />

            <button
              type="button"
              aria-label="Scroll projects left"
              tabIndex={canLeft ? 0 : -1}
              onClick={() => scrollBy(-1)}
              disabled={!canLeft}
              aria-disabled={!canLeft}
              className={`absolute left-1 sm:left-2 top-[38%] z-20 hidden -translate-y-1/2 md:inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl focus-ring transition-all duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                ${canLeft ? "bg-bg-surface/80 border-border text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
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
              className={`absolute right-1 sm:right-2 top-[38%] z-20 hidden -translate-y-1/2 md:inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl focus-ring transition-all duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                ${canRight ? "bg-bg-surface/80 border-border text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <div
              ref={viewportRef}
              data-lenis-prevent
              role="region"
              aria-label="Project list"
              aria-roledescription="carousel"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
              onPointerCancel={stopDrag}
              onClickCapture={onClickCapture}
              style={{ scrollSnapType: "none" }}
              className={`block w-full max-w-full min-w-0 box-border overflow-x-auto overflow-y-hidden overscroll-x-auto overscroll-behavior-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 py-2 [touch-action:pan-x] [overscroll-behavior-inline:none] [scroll-behavior:auto]`}
            >
              <div ref={trackRef} className="flex w-max max-w-none items-start gap-4 sm:gap-6 lg:gap-8">
                {filtered.map((project) => (
                  <div
                    key={project.id}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${project.title} — ${project.category}`}
                    className="shrink-0"
                  >
                    <ProjectCard project={project} featured={project.featured} />
                  </div>
                ))}
              </div>
            </div>

            {hasOverflow && (
              <div className="mx-auto mt-6 flex w-full max-w-xl flex-col items-center gap-3 px-2">
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Carousel progress"
                  className="relative h-1 w-full overflow-hidden rounded-pill bg-border"
                >
                  <div
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-pill bg-accent will-change-transform"
                    style={{
                      transform: `scaleX(${progress})`,
                      transition: prefersReduced ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                    aria-hidden
                  />
                </div>
                <div className="flex justify-center gap-1.5" role="group" aria-label="Project navigation">
                  {filtered.map((_, i) => {
                    const isActive = i === activeIdx;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Go to project ${i + 1} of ${filtered.length}`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => scrollToIndex(i)}
                        className={`h-1.5 rounded-pill transition-all duration-300 focus-ring outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${isActive ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-text-muted"}`}
                      />
                    );
                  })}
                </div>
                <span className="sr-only" aria-live="polite" aria-atomic="true">
                  Project {activeIdx + 1} of {filtered.length}
                  {active ? ` — ${active}` : ""}
                </span>
              </div>
            )}
          </div>
        )}

        <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
          {filtered.length} projects · {active}
        </span>
      </div>
    </section>
  );
}
