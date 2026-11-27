"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";

export type UseRevealOptions = {
  /** Set false for the hero: it is painted sharp immediately and never observed. */
  enabled?: boolean;
  /** Fraction of the section that must be visible before it reveals. */
  threshold?: number;
};

/**
 * Give every `.item` in this section its index so CSS can stagger with
 * `transition-delay: calc(var(--i) * 80ms)`. This is bookkeeping, not
 * animation — all motion stays in CSS in globals.css.
 */
function indexItems(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".item").forEach((el, i) => {
    if (!el.style.getPropertyValue("--i")) {
      el.style.setProperty("--i", String(i));
    }
  });
}

/**
 * Observes one section and toggles `is-revealed` on it. The class drives the
 * CSS transition; JS never touches opacity/filter/transform directly.
 *
 * The observer stays attached so the section also blurs/fades out on exit
 * (instead of unobserving after the first reveal). Reduced-motion and
 * no-Observer environments skip the observer entirely — CSS keeps them visible.
 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  enabled = true,
  threshold = 0.25,
}: UseRevealOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    indexItems(root);

    if (
      !enabled ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      root.classList.add("is-revealed");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        // Streamed-in children (e.g. the projects section) may arrive after
        // mount, so refresh indices when the section is next crossed.
        indexItems(root);
        // Compare the ratio rather than isIntersecting: at the 0.25 crossing
        // the target can still intersect while its ratio is already < 0.25.
        root.classList.toggle(
          "is-revealed",
          entry.intersectionRatio >= threshold
        );
      },
      { threshold }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [enabled, threshold]);

  return ref;
}

export type RevealProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Default `section`; use `div` when nesting inside an existing section. */
  as?: "section" | "div";
  hero?: boolean;
  threshold?: number;
};

/**
 * Wrap any section. Mark its animated children with `className="item"` —
 * they fade in, unblur and rise with an 80ms stagger, then blur/fade out
 * when the section leaves the viewport.
 */
export function Reveal({
  children,
  id,
  className = "",
  as = "section",
  hero = false,
  threshold = 0.25,
}: RevealProps): ReactNode {
  const ref = useReveal<HTMLElement>({ enabled: !hero, threshold });
  const classes = ["reveal-section", hero ? "is-revealed" : "", className]
    .filter(Boolean)
    .join(" ");

  if (as === "div") {
    return (
      <div
        ref={ref as unknown as Ref<HTMLDivElement>}
        id={id}
        className={classes}
      >
        {children}
      </div>
    );
  }

  return (
    <section ref={ref as unknown as Ref<HTMLElement>} id={id} className={classes}>
      {children}
    </section>
  );
}
