"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Scroll-to-top: appears after 2 viewports, Lenis-aware, reduced-motion safe. */
export function ScrollTop(): React.ReactNode {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > window.innerHeight * 2));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        try {
          const lenis = (window as unknown as { __lenis?: { scrollTo?: (t: number, o?: Record<string, unknown>) => void } }).__lenis;
          if (lenis?.scrollTo) {
            lenis.scrollTo(0, { duration: 1.1 });
            return;
          }
        } catch {}
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
      className="fixed bottom-20 right-4 z-[80] inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-surface/90 text-text-secondary shadow-lg backdrop-blur-xl transition-all hover:border-accent hover:text-accent-text focus-ring outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
