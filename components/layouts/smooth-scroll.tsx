"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Feature flag — local fallback until lib/config exists
const features = { smoothScroll: true } as const;

const LENIS_OPTIONS = {
  duration: 1.1,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical" as const,
  gestureOrientation: "vertical" as const,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 1.5,
  autoRaf: false,
} as const;

export function SmoothScroll({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  useEffect(() => {
    if (!features.smoothScroll) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis(LENIS_OPTIONS as never);
    // expose for vertical→horizontal sync (ProjectsCarousel) — optional velocity scaling
    (window as unknown as { __lenis?: unknown }).__lenis = lenis;

    // Sync Lenis → ScrollTrigger so pinned scrub stays in sync with smooth scroll
    lenis.on("scroll", ScrollTrigger.update);
    // Use GSAP ticker for Lenis raf to keep both in same tick (prevents jitter)
    const gsapTickerCb = (time: number) => {
      // gsap ticker time is seconds, lenis expects ms
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(gsapTickerCb);
    gsap.ticker.lagSmoothing(0);

    let rafId = 0;
    function raf(): void {
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    function handleAnchorClick(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const element = document.querySelector(href);
      if (!element) return;

      e.preventDefault();
      lenis.scrollTo(element as HTMLElement, { offset: -100 });
    }

    document.addEventListener("click", handleAnchorClick);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      cancelAnimationFrame(rafId);
      gsap.ticker.remove(gsapTickerCb);
      lenis.off("scroll", ScrollTrigger.update);
      try {
        delete (window as unknown as { __lenis?: unknown }).__lenis;
      } catch {}
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
