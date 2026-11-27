"use client";

import { useEffect } from "react";
import type Lenis from "lenis";
import {
  createLenisLoop,
  type LenisDriver,
} from "@/components/layout/lenis-loop";
import {
  LENIS_OPTIONS,
  shouldSmoothScroll,
} from "@/components/layout/smooth-scroll";

type ScopedLenis = Lenis &
  LenisDriver & {
    resize?: () => void;
    destroy(): void;
  };

function isScrollableY(el: HTMLElement): boolean {
  const overflowY = getComputedStyle(el).overflowY;
  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    el.scrollHeight > el.clientHeight + 1
  );
}

/**
 * The dashboard is a fixed-height app shell: its scrolling happens inside
 * panels, never on the window. The global Lenis instance therefore cannot
 * smooth it. This attaches scoped instances to the outermost scrollable
 * panels of the current tab; inner scrollers stay native via
 * `allowNestedScroll`, so lists, menus and dialogs keep working.
 */
export function DashboardSmoothScroll(): null {
  useEffect(() => {
    if (!shouldSmoothScroll()) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      const { default: LenisCtor } = await import("lenis");
      if (cancelled) return;

      const root = document.querySelector<HTMLElement>(".dash-root");
      if (!root) return;

      const create = LenisCtor as unknown as (options: unknown) => ScopedLenis;
      const managed = new Map<HTMLElement, ScopedLenis>();
      const loop = createLenisLoop(() => Array.from(managed.values()));

      const scan = (): void => {
        if (cancelled) return;

        // Narrow the DOM walk to elements that declare an overflow utility;
        // getComputedStyle on every node in a busy dashboard would thrash.
        const candidates = root.querySelectorAll<HTMLElement>(
          '[class*="overflow-y-auto"],[class*="overflow-y-scroll"],[class*="overflow-auto"],.custom-scrollbar,.commits-scroll,.trail-scroll,[style*="overflow"]'
        );
        const scrollables = Array.from(candidates).filter(isScrollableY);
        // Only the outermost overflowing panels get an instance. Anything
        // nested inside them is a native inner scroller (list, menu, dialog).
        const outer = scrollables.filter(
          (el) =>
            !scrollables.some((other) => other !== el && other.contains(el))
        );
        const wanted = new Set(outer);

        for (const [el, lenis] of managed) {
          if (!wanted.has(el) || !el.isConnected) {
            lenis.destroy();
            managed.delete(el);
          }
        }
        for (const el of wanted) {
          if (managed.has(el)) continue;
          const lenis = create({
            ...LENIS_OPTIONS,
            wrapper: el,
            content: el.firstElementChild ?? el,
          });
          lenis.on?.("scroll", loop.wake);
          lenis.resize?.();
          managed.set(el, lenis);
        }
        if (managed.size) loop.wake();
      };

      let scanTimer = 0;
      const scheduleScan = (): void => {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = window.setTimeout(scan, 120);
      };
      const observer = new MutationObserver(scheduleScan);
      observer.observe(root, { childList: true, subtree: true });
      window.addEventListener("resize", scheduleScan);
      scan();

      teardown = () => {
        if (scanTimer) clearTimeout(scanTimer);
        observer.disconnect();
        window.removeEventListener("resize", scheduleScan);
        loop.destroy();
        for (const lenis of managed.values()) lenis.destroy();
        managed.clear();
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return null;
}
