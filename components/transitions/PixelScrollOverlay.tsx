"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Props = {
  gridSize?: number;
  pixelColor?: string;
  animationStepDuration?: number;
  /** selector for sections to watch, defaults to [data-pixel-section] */
  sectionSelector?: string;
  /** z-index for overlay */
  zIndex?: number;
};

export function PixelScrollOverlay({
  gridSize = 20,
  pixelColor,
  animationStepDuration = 0.45,
  sectionSelector = "[data-pixel-section]",
  zIndex = 60,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const delayedRef = useRef<gsap.core.Tween | null>(null);
  const pixelsRef = useRef<HTMLDivElement[]>([]);

  // resolve pixel color: use CSS var if not provided — accent for visibility
  const color = pixelColor ?? "var(--accent-primary, #a3e635)";

  // build grid
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.innerHTML = "";
    pixelsRef.current = [];

    // adapt columns/rows to viewport aspect so pixels stay roughly square-ish
    // gridSize is base columns; rows auto-calc from viewport ratio
    const cols = gridSize;
    // we use CSS grid approach for even distribution — generate cols*rows divs
    // but to keep approx square, compute rows based on window aspect at mount
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
    const aspect = vw / vh;
    // aim for square pixels: rows = cols / aspect
    const rows = Math.max(8, Math.round(cols / aspect * 1.1));
    // total pixels
    const total = cols * rows;

    // use CSS grid via absolute positioned divs like original: width/height % based on grid
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pixel = document.createElement("div");
        pixel.className = "pixel-scroll__pixel";
        pixel.style.backgroundColor = color;
        pixel.style.position = "absolute";
        pixel.style.display = "none";
        // avoid subpixel gaps: overlap by 0.5px via calc
        const w = 100 / cols;
        const h = 100 / rows;
        pixel.style.width = `calc(${w}% + 1px)`;
        pixel.style.height = `calc(${h}% + 1px)`;
        pixel.style.left = `${col * w}%`;
        pixel.style.top = `${row * h}%`;
        pixel.style.willChange = "opacity, transform";
        grid.appendChild(pixel);
        pixelsRef.current.push(pixel);
      }
    }
    void total;

    const onResize = () => {
      // rebuild on large resize to keep square-ish — debounced
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [gridSize, color]);

  const trigger = useCallback(() => {
    const pixels = pixelsRef.current;
    if (!pixels.length) return;
    if (isAnimatingRef.current) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    isAnimatingRef.current = true;
    gsap.killTweensOf(pixels);
    if (delayedRef.current) delayedRef.current.kill();

    gsap.set(pixels, { display: "none" });

    const total = pixels.length;
    const staggerDuration = animationStepDuration / total;

    // Phase 1: cover — pixels appear randomly
    gsap.to(pixels, {
      display: "block",
      duration: 0,
      stagger: { each: staggerDuration, from: "random" },
    });

    // midpoint swap would happen here — but since we're overlaying scroll,
    // we just hold covered briefly then reveal
    delayedRef.current = gsap.delayedCall(animationStepDuration + 0.08, () => {
      isAnimatingRef.current = false;
    });

    // Phase 2: reveal — pixels disappear randomly
    gsap.to(pixels, {
      display: "none",
      duration: 0,
      delay: animationStepDuration,
      stagger: { each: staggerDuration, from: "random" },
      onComplete: () => {
        // ensure all hidden
        gsap.set(pixels, { display: "none" });
      },
    });
  }, [animationStepDuration]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    // wait for DOM sections to mount
    const setup = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector));
      if (sections.length < 2) return () => {};

      // we trigger when a section after the first enters near viewport top
      // and also when scrolling back up
      const triggers: ScrollTrigger[] = [];

      sections.forEach((section, idx) => {
        if (idx === 0) return;
        const st = ScrollTrigger.create({
          trigger: section,
          start: "top 82%",
          end: "top 82%",
          onEnter: () => trigger(),
          onEnterBack: () => trigger(),
        });
        triggers.push(st);
      });

      // Also hook Lenis if present for smoother feel — no extra logic needed
      // Refresh after images load
      const imgs = document.querySelectorAll("img");
      const onLoad = () => ScrollTrigger.refresh();
      imgs.forEach((img) => {
        if (!img.complete) img.addEventListener("load", onLoad, { once: true });
      });

      return () => {
        triggers.forEach((t) => t.kill());
        imgs.forEach((img) => img.removeEventListener("load", onLoad));
      };
    };

    // delay to ensure sections rendered (ProjectsSection async filter etc.)
    const t = window.setTimeout(() => {
      const cleanup = setup();
      // store for later cleanup
      (window as unknown as { __pixelCleanup?: () => void }).__pixelCleanup = cleanup as unknown as () => void;
    }, 200);

    return () => {
      window.clearTimeout(t);
      const c = (window as unknown as { __pixelCleanup?: () => void }).__pixelCleanup;
      if (c) c();
      ScrollTrigger.getAll().forEach((st) => {
        // only kill our pixel triggers (start 82% ones)
        if (st.vars.start === "top 82%") st.kill();
      });
      if (delayedRef.current) delayedRef.current.kill();
    };
  }, [sectionSelector, trigger]);

  return (
    <div
      aria-hidden
      className="pixel-scroll-overlay pointer-events-none fixed inset-0"
      style={{ zIndex, contain: "layout paint" }}
    >
      <div
        ref={gridRef}
        className="absolute inset-0 overflow-hidden"
        style={{ background: "transparent" }}
      />
      {/* subtle vignette during transition for depth */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pixel-scroll-overlay { display: none !important; }
        }
      `}</style>
    </div>
  );
}
