"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/Data/projects";
import { ProjectCard } from "./ProjectCard";

type Props = {
  projects: readonly Project[];
  active?: string;
};

export function ProjectsCarousel({ projects, active }: Props) {
  const visible = projects;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [progress, setProgress] = useState(0);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const draggedRecently = useRef(false);
  const isSmoothScrolling = useRef(false);
  const smoothTimer = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  const updateScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    if (isSmoothScrolling.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth + 4) {
      if (canLeft || canRight || progress !== 0) {
        setCanLeft(false);
        setCanRight(false);
        setProgress(0);
      }
      return;
    }
    const nextCanLeft = scrollLeft > 8;
    const nextCanRight = scrollLeft + clientWidth < scrollWidth - 8;
    const nextProgress = scrollLeft / (scrollWidth - clientWidth);
    setCanLeft((prev) => (prev !== nextCanLeft ? nextCanLeft : prev));
    setCanRight((prev) => (prev !== nextCanRight ? nextCanRight : prev));
    setProgress((prev) => (Math.abs(prev - nextProgress) > 0.005 ? nextProgress : prev));
  };

  const scheduleUpdate = () => {
    if (rafId.current) return;
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;
      updateScroll();
    });
  };

  const flushScrollState = () => {
    isSmoothScrolling.current = false;
    if (smoothTimer.current) {
      window.clearTimeout(smoothTimer.current);
      smoothTimer.current = null;
    }
    updateScroll();
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScroll();
    const onScroll = () => {
      if (isSmoothScrolling.current) return;
      scheduleUpdate();
    };
    const onScrollEnd = () => flushScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd as EventListener);
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd as EventListener);
      window.removeEventListener("resize", scheduleUpdate);
      ro.disconnect();
      if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const prevActive = useRef(active);
  const prevLen = useRef(visible.length);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (prevActive.current !== active || prevLen.current !== visible.length) {
      prevActive.current = active;
      prevLen.current = visible.length;
      requestAnimationFrame(() => {
        el.scrollTo({ left: 0, behavior: "auto" });
        requestAnimationFrame(updateScroll);
      });
    }
  }, [active, visible.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    isSmoothScrolling.current = true;
    if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
    smoothTimer.current = window.setTimeout(flushScrollState, 650);
    el.scrollBy({ left: dir * (el.clientWidth * 0.82), behavior: "smooth" });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    // children[0] is first card wrapper; use offsetLeft for accurate rail with padding
    const targetEl = children[index];
    if (targetEl) {
      isSmoothScrolling.current = true;
      if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
      smoothTimer.current = window.setTimeout(flushScrollState, 650);
      const left = targetEl.offsetLeft - el.offsetLeft - 16;
      el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      return;
    }
    // fallback: proportional
    const fallback = (el.scrollWidth - el.clientWidth) * (index / Math.max(1, visible.length - 1));
    isSmoothScrolling.current = true;
    if (smoothTimer.current) window.clearTimeout(smoothTimer.current);
    smoothTimer.current = window.setTimeout(flushScrollState, 650);
    el.scrollTo({ left: fallback, behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    isDragging.current = false;
    draggedRecently.current = false;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
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
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (isDragging.current) {
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {}
      draggedRecently.current = true;
      window.setTimeout(() => {
        draggedRecently.current = false;
      }, 220);
    }
    isDragging.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
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
      scrollToIndex(visible.length - 1);
    }
  };

  // Wheel: only hijack when explicit horizontal intent (deltaX dominant or Shift held).
  // Otherwise let page scroll vertically — fixes "scroll left/right" trap.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 4) return;
    const isHorizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (!isHorizontalIntent) return;
    const delta = e.shiftKey && Math.abs(e.deltaX) < 2 ? e.deltaY : e.deltaX || e.deltaY;
    if (Math.abs(delta) < 2) return;
    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    if ((delta > 0 && atRight) || (delta < 0 && atLeft)) return;
    e.preventDefault();
    el.scrollBy({ left: delta, behavior: "auto" });
  };

  const hasOverflow = visible.length > 1;

  return (
    <div className="relative w-full max-w-full overflow-hidden isolate">
      {/* edge fades — never intercept pointer, blur for antigravity depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 sm:w-10 lg:w-16 bg-gradient-to-r from-bg-primary via-bg-primary/70 to-transparent opacity-90"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 sm:w-10 lg:w-16 bg-gradient-to-l from-bg-primary via-bg-primary/70 to-transparent opacity-90"
      />

      {/* arrows — 44px min hit area, hidden when disabled (no layout shift) */}
      <button
        type="button"
        aria-label="Scroll projects left"
        aria-hidden={!canLeft}
        tabIndex={canLeft ? 0 : -1}
        onClick={() => scrollBy(-1)}
        disabled={!canLeft}
        className={`absolute left-2 sm:left-4 lg:left-6 top-[46%] z-20 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md focus-ring transition-opacity duration-200 ease-out will-change-transform
          ${canLeft ? "bg-bg-surface/90 border-border-strong text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll projects right"
        aria-hidden={!canRight}
        tabIndex={canRight ? 0 : -1}
        onClick={() => scrollBy(1)}
        disabled={!canRight}
        className={`absolute right-2 sm:right-4 lg:right-6 top-[46%] z-20 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md focus-ring transition-opacity duration-200 ease-out will-change-transform
          ${canRight ? "bg-bg-surface/90 border-border-strong text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer opacity-100" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* scroller — contained rail, snap, touch-action, Lenis isolated */}
      <div
        ref={scrollerRef}
        data-lenis-prevent
        role="region"
        aria-label="Project carousel"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex w-full max-w-full items-stretch gap-4 sm:gap-5 lg:gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-xl py-5 snap-x snap-mandatory [touch-action:pan-y_pinch-zoom] [scroll-padding-inline:16px] sm:[scroll-padding-inline:24px] lg:[scroll-padding-inline:32px] ps-4 sm:ps-6 lg:ps-8 pe-4 sm:pe-6 lg:pe-8"
      >
        {visible.map((project, idx) => {
          const featured = active === "Best Works" && idx === 1 && visible.length >= 3;
          return (
            <div
              key={project.id}
              className={`shrink-0 snap-start will-change-transform ${featured ? "lg:-mb-3" : ""}`}
            >
              <ProjectCard project={project} featured={featured} />
            </div>
          );
        })}
      </div>

      {/* progress + dots */}
      {hasOverflow && (
        <div className="mx-auto mt-4 flex w-full max-w-xl flex-col items-center gap-3 px-6">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carousel progress"
            className="relative h-1 w-full overflow-hidden rounded-pill bg-border"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-accent transition-[width] duration-300 ease-out will-change-[width]"
              style={{ width: `${progress * 100}%` }}
              aria-hidden
            />
          </div>
          <div className="flex justify-center gap-1.5">
            {visible.map((_, i) => {
              const activeIdx = Math.round(progress * Math.max(1, visible.length - 1));
              const isActive = i === activeIdx;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => scrollToIndex(i)}
                  className={`h-1.5 rounded-pill transition-all duration-300 focus-ring outline-none ${isActive ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-text-muted"}`}
                />
              );
            })}
          </div>
          <span className="sr-only" aria-live="polite">
            Slide {Math.round(progress * Math.max(1, visible.length - 1)) + 1} of {visible.length}
            {active ? ` — ${active}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
