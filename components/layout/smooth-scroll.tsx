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
  // Dashboard membership only: the Lenis instance must survive normal route
  // changes. Project modals are intercepting routes (pathname / -> detail and
  // back) — recreating Lenis on every pathname change destroys the instance
  // the open modal just stopped(), so wheel over the modal gutters scrolls
  // the page behind it. Only entering/leaving /dashboard toggles the instance.
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;

  useEffect(() => {
    if (!features.smoothScroll) return;

    // The dashboard is an app-like UI with its own nested scroll containers
    // (main column, modals). Lenis hijacks wheel events at window level, which
    // leaves those inner scrollers dead — so it stays off on /dashboard.
    if (isDashboard) return;

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
      // A modal (project, booking, CV) may already be open — e.g. a refresh
      // that remounts providers under the dialog, or a recreation racing the
      // modal's own stop(). An open dialog always wants the background held.
      try {
        if (document.querySelector('[role="dialog"]')) {
          (lenis as unknown as { stop?: () => void }).stop?.();
        }
      } catch {
        // non-fatal: modal effect will stop Lenis on its own pass
      }

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
      // INP: the old loop ran lenis.raf() every frame forever, keeping
      // the main thread hot and raising input delay for every click.
      // Now the loop sleeps after 2.5s idle and wakes on real activity,
      // plus it never pumps frames while the tab is hidden.
      const IDLE_MS = 2500;
      let raf = 0;
      let lastActivity = performance.now();
      const loop = (time: number): void => {
        if (document.hidden) {
          raf = 0;
          return;
        }
        const scrolling =
          (lenis as unknown as { isScrolling?: boolean }).isScrolling === true;
        if (scrolling || performance.now() - lastActivity < IDLE_MS) {
          lenis.raf(time);
          raf = requestAnimationFrame(loop);
        } else {
          raf = 0; // sleep until wake()
        }
      };
      const wake = (): void => {
        lastActivity = performance.now();
        if (!raf) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const markActive = (): void => {
        lastActivity = performance.now();
      };
      try {
        (lenis as unknown as { on?: (ev: string, cb: () => void) => void }).on?.(
          "scroll",
          markActive
        );
      } catch {
        // non-fatal: idle timer alone still sleeps the loop
      }
      window.addEventListener("wheel", wake, { passive: true });
      window.addEventListener("touchmove", wake, { passive: true });
      window.addEventListener("keydown", wake);
      const handleVisibility = (): void => {
        if (document.hidden) {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        } else {
          wake();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

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
        wake();
        lenis.scrollTo(element as HTMLElement, { offset: -80 });
      }

      document.addEventListener("click", handleAnchorClick);

      cleanup = () => {
        document.removeEventListener("click", handleAnchorClick);
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("wheel", wake);
        window.removeEventListener("touchmove", wake);
        window.removeEventListener("keydown", wake);
        if (raf) cancelAnimationFrame(raf);
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
  }, [isDashboard]);

  return <>{children}</>;
}
