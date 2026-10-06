"use client";

import { useSectionTransition, requestSectionNavigate, pagerEnabled } from "@/components/transitions/SectionTransition";
import { useEffect, useState } from "react";

/** Fixed pager dots: position cue for the 4-screen desktop pager.
 *  Renders only when the pager is active (md+ fine pointer, full motion). */
export function PagerDots(): React.ReactNode {
  const { activeId, navigateTo } = useSectionTransition();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setEnabled(pagerEnabled());
      } catch {
        setEnabled(false);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [activeId]);
  if (!enabled) return null;
  const ids = [
    { id: "hero", label: "Home" },
    { id: "stack-wrap", label: "Stack" },
    { id: "projects-wrap", label: "Projects" },
    { id: "contact-wrap", label: "Contact" },
  ];
  return (
    <nav aria-label="Sections" className="fixed right-4 top-1/2 z-[80] hidden -translate-y-1/2 flex-col gap-2 md:flex">
      {ids.map((s) => {
        const on = activeId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.label}`}
            aria-current={on ? "true" : undefined}
            onClick={() => (pagerEnabled() ? navigateTo(s.id) : requestSectionNavigate(s.id))}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 focus-ring outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              on ? "" : "hover:bg-bg-surface"
            }`}
          >
            <span
              aria-hidden
              className={`block h-2 rounded-full transition-all duration-300 ${
                on ? "w-6 bg-accent" : "w-2 bg-border-strong"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
