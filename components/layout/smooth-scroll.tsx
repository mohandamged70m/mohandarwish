"use client";

import { useEffect, type ReactNode } from "react";
import type Lenis from "lenis";
import "lenis/dist/lenis.css";
import { features } from "@/lib/config";
import { isMotionForced } from "@/lib/motion";
import { createLenisLoop, type LenisDriver } from "./lenis-loop";

export const LENIS_OPTIONS = {
  duration: 1.1,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical" as const,
  gestureOrientation: "vertical" as const,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 1.5,
  autoRaf: false,
  // The dashboard (and the carousels) have their own scroll containers. Let
  // those scroll natively instead of Lenis swallowing their wheel events.
  // Scoped dashboard panels get their own Lenis instance from
  // components/dashboard-v2/DashboardSmoothScroll.
  allowNestedScroll: true,
} as const;

/** Shared gate so the window instance and the dashboard instances agree. */
export function shouldSmoothScroll(): boolean {
  if (!features.smoothScroll) return false;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  // ?motion=full previews the full experience on a reduce-motion machine.
  return !prefersReducedMotion || isMotionForced();
}

export function SmoothScroll({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  useEffect(() => {
    if (!shouldSmoothScroll()) return;

    // Dynamically import Lenis so it never lands in the initial bundle. The
    // instance is created once and survives every route change — including
    // /dashboard, where scoped instances smooth the app's own scroll panels.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { default: LenisCtor } = await import("lenis");
      if (cancelled) return;

      const lenis = new LenisCtor(LENIS_OPTIONS as never) as Lenis & LenisDriver & {
        stop?: () => void;
        scrollTo?: (target: HTMLElement, options?: { offset?: number }) => void;
      };
      // Expose for programmatic scroll (ScrollTop, modals, nav).
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;

      // A modal (project, booking, CV) may already be open — e.g. a refresh
      // that remounts providers under the dialog. An open dialog always wants
      // the background held.
      try {
        if (document.querySelector('[role="dialog"]')) {
          lenis.stop?.();
        }
      } catch {
        // non-fatal: modal effect will stop Lenis on its own pass
      }

      const loop = createLenisLoop(() => [lenis]);

      function handleAnchorClick(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a[href^="#"]');
        if (!anchor) return;

        // Dashboard anchors jump inside its own scroller; Lenis owns the
        // window here and must not preventDefault on them.
        if (anchor.closest(".dash-root")) return;

        // The section pager owns section jumps (curtain + Lenis-stop + instant
        // jump): a competing Lenis glide to the same anchor visibly fights it.
        if (document.documentElement.dataset.sectionTransition === "1") return;
        if (anchor.closest("nav")) return;

        const href = anchor.getAttribute("href");
        if (!href || href === "#") return;

        const element = document.querySelector(href);
        if (!element) return;

        e.preventDefault();
        loop.wake();
        lenis.scrollTo?.(element as HTMLElement, { offset: -80 });
      }

      document.addEventListener("click", handleAnchorClick);

      cleanup = () => {
        document.removeEventListener("click", handleAnchorClick);
        loop.destroy();
        try {
          delete (window as unknown as { __lenis?: unknown }).__lenis;
        } catch (e) {
          if (process.env.NODE_ENV !== "production")
            console.warn("smooth-scroll cleanup failed", e);
        }
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
