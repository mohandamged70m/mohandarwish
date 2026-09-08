"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "lenis/dist/lenis.css";
import { features } from "@/lib/config";

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
  const pathname = usePathname();

  useEffect(() => {
    if (!features.smoothScroll) return;

    // The dashboard is an app-like UI with its own nested scroll containers
    // (main column, modals). Lenis hijacks wheel events at window level, which
    // leaves those inner scrollers dead — so it stays off on /dashboard.
    if (pathname?.startsWith("/dashboard")) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    // Dynamically import Lenis + GSAP so they never land in the initial
    // bundle (per docs/01-app/02-guides/lazy-loading.md). Same LENIS_OPTIONS,
    // same GSAP ticker sync — behavior unchanged, just code-split.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis(LENIS_OPTIONS as never);
      // expose for section components that need programmatic scroll — optional velocity scaling
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

      cleanup = () => {
        document.removeEventListener("click", handleAnchorClick);
        gsap.ticker.remove(gsapTickerCb);
        lenis.off("scroll", ScrollTrigger.update);
        try {
          delete (window as unknown as { __lenis?: unknown }).__lenis;
        } catch {}
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname]);

  return <>{children}</>;
}
