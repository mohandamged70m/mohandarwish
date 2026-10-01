"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "lenis/dist/lenis.css";
import { features } from "@/lib/config";
import { isMotionForced } from "@/lib/motion";

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

    // ?motion=full previews the full experience on a reduce-motion machine.
    if (prefersReducedMotion && !isMotionForced()) return;

    // Dynamically import Lenis so it never lands in the initial bundle (per
    // docs/01-app/02-guides/lazy-loading.md). Same LENIS_OPTIONS.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;

      const lenis = new Lenis(LENIS_OPTIONS as never);
      // expose for section components that need programmatic scroll — optional velocity scaling
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;

      // `autoRaf: false` above means we own the frame loop, so pump Lenis from a
      // plain rAF instead of borrowing the GSAP ticker.
      //
      // This previously pulled in `gsap` + `gsap/ScrollTrigger` purely to
      // run `lenis.on("scroll", ScrollTrigger.update)`. There is not a
      // single ScrollTrigger in this codebase — zero pinned/scrubbed
      // sections — so that only ever ran the plugin's per-scroll update
      // bookkeeping and the GSAP ticker's perpetual rAF wakeups, for no
      // visual effect. GSAP is still lazily loaded where it IS used (the
      // nav menu timeline), just not here.
      let raf = 0;
      const loop = (time: number): void => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      function handleAnchorClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a[href^="#"]');
        if (!anchor) return;

        // The pager owns section jumps (curtain + Lenis-stop + instant jump):
        // a competing Lenis glide to the same anchor visibly fights it.
        if (document.documentElement.dataset.sectionTransition === '1') return;
        if (anchor.closest('nav')) return;

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
        cancelAnimationFrame(raf);
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
