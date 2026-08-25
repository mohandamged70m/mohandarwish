"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/Data/projects";
import { ProjectCard } from "./ProjectCard";

type Props = {
  projects: readonly Project[];
};

export function ProjectsCarousel({ projects }: Props) {
  const visible = projects;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [progress, setProgress] = useState(0);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const updateScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth + 4) {
      setCanLeft(true);
      setCanRight(true);
      setProgress(0);
      return;
    }
    setCanLeft(scrollLeft > 8);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 8);
    setProgress(scrollLeft / (scrollWidth - clientWidth));
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener("scroll", updateScroll, { passive: true });
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    window.addEventListener("resize", updateScroll);
    return () => {
      el.removeEventListener("scroll", updateScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateScroll);
    };
  }, [visible]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) {
      el.scrollBy({ left: dir * 360, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: "smooth" });
  };

  // drag to scroll
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    el.scrollLeft = scrollStart.current - dx;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    const el = scrollerRef.current;
    if (!el) return;
    el.releasePointerCapture(e.pointerId);
    el.style.cursor = "grab";
    el.style.userSelect = "";
  };

  // keyboard
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBy(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBy(1);
    }
  };

  // wheel: convert vertical wheel to horizontal scroll only when carousel
  // can scroll further in that direction; otherwise allow page to scroll
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 4) return;
    // if user is scrolling horizontally (shift+wheel or trackpad), don't hijack
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (Math.abs(e.deltaY) < 4) return;

    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    const scrollingDown = e.deltaY > 0;
    const scrollingUp = e.deltaY < 0;

    // at edge in the scroll direction -> let page scroll naturally
    if ((scrollingDown && atRight) || (scrollingUp && atLeft)) return;

    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  return (
    <div className="relative w-full group/carousel">
      {/* edge fades */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 sm:w-12 bg-gradient-to-r from-bg-primary via-bg-primary/60 to-transparent lg:w-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 sm:w-12 bg-gradient-to-l from-bg-primary via-bg-primary/60 to-transparent lg:w-20"
      />

      {/* arrows — floating glass pills, hover accent, show on hover/focus */}
      <button
        type="button"
        aria-label="Scroll projects left"
        onClick={() => scrollBy(-1)}
        disabled={!canLeft}
        className={`absolute left-3 sm:left-4 lg:left-6 top-[46%] z-20 -translate-y-1/2 inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 focus-ring opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 focus:opacity-100
          ${canLeft ? "bg-bg-surface/90 border-border-strong text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronLeft className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll projects right"
        onClick={() => scrollBy(1)}
        disabled={!canRight}
        className={`absolute right-3 sm:right-4 lg:right-6 top-[46%] z-20 -translate-y-1/2 inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 focus-ring opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 focus:opacity-100
          ${canRight ? "bg-bg-surface/90 border-border-strong text-text-primary shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:bg-accent hover:border-accent hover:text-text-on-accent hover:shadow-[0_0_20px_var(--accent-ring)] hover:scale-[1.04] active:scale-[0.98] cursor-pointer" : "bg-bg-surface/40 border-border text-text-muted opacity-0 pointer-events-none"}`}
      >
        <ChevronRight className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </button>

      {/* scroller */}
      <div className="flex justify-center">
        <div
          ref={scrollerRef}
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
          className="flex items-end gap-4 sm:gap-5 lg:gap-6 overflow-x-auto lg:overflow-x-auto snap-x snap-mandatory lg:snap-none px-[12vw] sm:px-[8vw] lg:px-[2vw] py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-xl"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((project, idx) => {
              const featured = idx === 1 && visible.length === 3;
              return (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.85, delay: idx * 0.06 }}
                  className={`snap-center shrink-0 ${featured ? "lg:-mb-3 lg:translate-y-1" : ""}`}
                >
                  <ProjectCard project={project} featured={featured} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* progress + dots */}
      <div className="mx-auto mt-4 flex w-full max-w-xl flex-col items-center gap-3 px-6">
        <div className="relative h-1 w-full overflow-hidden rounded-pill bg-border">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-pill bg-accent"
            style={{ width: `${Math.max(24, progress * 100)}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            aria-hidden
          />
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {visible.map((_, i) => {
            const activeIdx = Math.round(progress * Math.max(1, visible.length - 1));
            const isActive = i === activeIdx;
            return (
              <span
                key={i}
                className={`h-1 rounded-pill transition-all duration-300 ${isActive ? "w-6 bg-accent" : "w-1.5 bg-border-strong"}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
