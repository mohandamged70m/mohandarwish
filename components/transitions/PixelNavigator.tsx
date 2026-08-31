"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import PixelCurtainTransition from "./PixelCurtainTransition";
import { PixelScrollOverlay } from "./PixelScrollOverlay";

type SectionDef = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type Props = {
  sections: SectionDef[];
  gridSize?: number;
  pixelColor?: string;
  animationStepDuration?: number;
};

// Revil-inspired: desktop paginated with pixel curtain, mobile single scroll with pixel flashes
export function PixelNavigator({ sections, gridSize = 20, pixelColor = "var(--accent-primary)", animationStepDuration = 0.42 }: Props) {
  const ids = sections.map((s) => s.id);
  const labels = sections.map((s) => s.label);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mountedSet, setMountedSet] = useState<Set<string>>(() => new Set([ids[0]]));

  const directionRef = useRef(0);
  const currentIdxRef = useRef(currentIdx);
  const scrollAccum = useRef(0);
  const lastWheel = useRef(0);
  const cooldownUntil = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const mobileScroll = isMobile;

  // lazy mount for mobile scroll (like Revil) — use window scroll, not container, to keep Lenis + window anchors intact
  useEffect(() => {
    if (!mobileScroll) return;
    const MOUNT_AHEAD = 600;
    const compute = () => {
      const vh = window.innerHeight;
      const reached: string[] = [];
      for (const id of ids) {
        const el = document.getElementById(`mobsec-${id}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= vh + MOUNT_AHEAD && r.bottom >= -MOUNT_AHEAD) reached.push(id);
      }
      setMountedSet((prev) => {
        const missing = reached.filter((id) => !prev.has(id));
        if (!missing.length) return prev;
        const next = new Set(prev);
        missing.forEach((id) => next.add(id));
        return next;
      });
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    const t = window.setTimeout(
      () => setMountedSet((prev) => (prev.size === ids.length ? prev : new Set(ids))),
      2200
    );
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [mobileScroll, ids]);

  const getScrollContainer = useCallback((idx: number) => {
    const id = ids[idx];
    return document.getElementById(`section-${id}`) as HTMLDivElement | null;
  }, [ids]);

  const navigateTo = useCallback(
    (targetIdx: number) => {
      if (targetIdx === currentIdxRef.current || isTransitioning) return;
      if (targetIdx < 0 || targetIdx >= ids.length) return;
      const dir = targetIdx > currentIdxRef.current ? 1 : -1;
      // allow secret-like horizontal trigger with ±2 later if needed
      directionRef.current = dir;
      setNextIdx(targetIdx);
      setIsTransitioning(true);
    },
    [ids.length, isTransitioning]
  );

  const onCurtainCovered = useCallback(() => {
    setCurrentIdx(nextIdx);
    // reset scroll of new section to top after swap (next frame)
    requestAnimationFrame(() => {
      const c = getScrollContainer(nextIdx);
      if (c) c.scrollTop = 0;
    });
  }, [nextIdx, getScrollContainer]);

  const onTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    cooldownUntil.current = Date.now() + 400;
  }, []);

  // expose navigate globally for Nav links (optional)
  useEffect(() => {
    (window as unknown as { __pixelNavigate?: (id: string) => void }).__pixelNavigate = (id: string) => {
      const idx = ids.indexOf(id);
      if (idx !== -1) navigateTo(idx);
    };
    return () => {
      try {
        delete (window as unknown as { __pixelNavigate?: unknown }).__pixelNavigate;
      } catch {}
    };
  }, [ids, navigateTo]);

  // Wheel at edges (Revil logic: accumulator + cooldown)
  useEffect(() => {
    if (mobileScroll) return;
    const handler = (e: WheelEvent) => {
      const now = Date.now();
      if (now < cooldownUntil.current) return;
      if (isTransitioning) return;
      if (document.body.style.overflow === "hidden") return;
      const container = getScrollContainer(currentIdxRef.current);
      if (!container) return;

      if (now - lastWheel.current > 200) scrollAccum.current = 0;
      lastWheel.current = now;

      const isDown = e.deltaY > 0;
      const isUp = e.deltaY < 0;
      const atBottom = Math.ceil(container.clientHeight + container.scrollTop) >= container.scrollHeight - 5;
      const atTop = container.scrollTop <= 5;
      const THRESHOLD = 50;

      if (isDown && atBottom) {
        scrollAccum.current += e.deltaY;
        if (scrollAccum.current > THRESHOLD) {
          scrollAccum.current = 0;
          cooldownUntil.current = now + 1500;
          if (currentIdxRef.current < ids.length - 1) navigateTo(currentIdxRef.current + 1);
        }
      } else if (isUp && atTop) {
        scrollAccum.current += e.deltaY;
        if (scrollAccum.current < -THRESHOLD) {
          scrollAccum.current = 0;
          cooldownUntil.current = now + 1500;
          if (currentIdxRef.current > 0) navigateTo(currentIdxRef.current - 1);
        }
      } else {
        scrollAccum.current = 0;
      }
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [mobileScroll, isTransitioning, getScrollContainer, ids.length, navigateTo]);

  // Touch swipe (vertical for section, horizontal ignored unless at edges)
  const onTouchStart = (e: React.TouchEvent) => {
    if (mobileScroll) return;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (mobileScroll) return;
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };
  const onTouchEnd = () => {
    if (mobileScroll) return;
    if (isTransitioning || document.body.style.overflow === "hidden") return;
    const TH = 90;
    const dx = touchStartX.current - touchEndX.current;
    const dy = touchStartY.current - touchEndY.current;
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    touchEndY.current = 0;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    const container = getScrollContainer(currentIdxRef.current);
    if (!container) return;
    const atBottom = Math.ceil(container.clientHeight + container.scrollTop) >= container.scrollHeight - 5;
    const atTop = container.scrollTop <= 5;

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > TH && atBottom && currentIdxRef.current < ids.length - 1) navigateTo(currentIdxRef.current + 1);
      else if (dy < -TH && atTop && currentIdxRef.current > 0) navigateTo(currentIdxRef.current - 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({ y: dir > 0 ? "100vh" : "-100vh", x: 0, opacity: 1, scale: 0.97 }),
    center: { y: 0, x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ y: dir < 0 ? "100vh" : "-100vh", x: 0, opacity: 1, scale: 0.97 }),
  };

  const current = sections[currentIdx];

  // Keyboard arrows
  useEffect(() => {
    if (mobileScroll) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        const c = getScrollContainer(currentIdxRef.current);
        if (!c) return;
        const atBottom = Math.ceil(c.clientHeight + c.scrollTop) >= c.scrollHeight - 5;
        if (atBottom && currentIdxRef.current < ids.length - 1) {
          e.preventDefault();
          navigateTo(currentIdxRef.current + 1);
        }
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        const c = getScrollContainer(currentIdxRef.current);
        if (!c) return;
        if (c.scrollTop <= 5 && currentIdxRef.current > 0) {
          e.preventDefault();
          navigateTo(currentIdxRef.current - 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileScroll, isTransitioning, getScrollContainer, ids.length, navigateTo]);

  if (mobileScroll) {
    return (
      <>
        <PixelScrollOverlay gridSize={gridSize} pixelColor={pixelColor} animationStepDuration={animationStepDuration} sectionSelector="[data-mobsec]" />
        <div className="w-full">
          {sections.map((s) => (
            <section key={s.id} id={`mobsec-${s.id}`} data-mobsec={s.id} className="relative min-h-[100dvh] w-full">
              {mountedSet.has(s.id) ? s.content : <div className="min-h-[100dvh] w-full" aria-hidden />}
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <div ref={mainRef} className="relative w-full h-[100dvh] overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* subtle dot nav like Revil */}
      <div className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-center gap-2">
        {sections.map((s, i) => (
          <button
            key={s.id}
            aria-label={`Go to ${s.label}`}
            aria-current={i === currentIdx ? "true" : undefined}
            onClick={() => navigateTo(i)}
            disabled={isTransitioning}
            className={`h-2 rounded-full transition-all duration-300 ${i === currentIdx ? "w-8 bg-accent" : "w-2 bg-border-strong hover:bg-text-muted"}`}
          />
        ))}
        <span className="mt-2 font-heading text-[10px] tracking-widest text-text-muted/60 uppercase">{current.label}</span>
      </div>

      <AnimatePresence initial={false} custom={directionRef.current} mode="popLayout">
        <motion.div
          key={current.id}
          id={`section-${current.id}`}
          custom={directionRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 340, damping: 34 },
            y: { type: "spring", stiffness: 340, damping: 34 },
            opacity: { duration: 0.18 },
            scale: { duration: 0.28 },
          }}
          className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar isolate"
        >
          <div className="min-h-[100dvh] w-full flex flex-col justify-center">{current.content}</div>
        </motion.div>
      </AnimatePresence>

      {/* Hint */}
      <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-20 hidden md:flex flex-col items-center gap-2">
        <span className="font-heading text-[10px] tracking-[0.14em] uppercase text-text-muted/50">Scroll or swipe at edges to navigate</span>
        <span className="h-6 w-px bg-gradient-to-b from-border-strong to-transparent" />
      </div>

      <PixelCurtainTransition
        isTransitioning={isTransitioning}
        onCurtainCovered={onCurtainCovered}
        onTransitionComplete={onTransitionComplete}
        nextSectionName={labels[nextIdx]}
        direction={directionRef.current}
        gridSize={gridSize}
        pixelColor={pixelColor}
        animationStepDuration={animationStepDuration}
      />
    </div>
  );
}
