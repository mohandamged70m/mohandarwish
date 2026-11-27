"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export type SectionDotItem = { id: string; label: string };

/**
 * Fixed right-edge dot nav. A second IntersectionObserver with a zero-height
 * root band at the viewport centre marks the active dot. Dots are real buttons
 * (aria-label + visible focus ring) and use native smooth scrolling.
 */
export function SectionDots({
  sections,
}: {
  sections: readonly SectionDotItem[];
}): ReactNode {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const sectionKey = useMemo(
    () => sections.map((s) => s.id).join("|"),
    [sections]
  );

  useEffect(() => {
    const els = (sectionKey ? sectionKey.split("|") : [])
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionKey]);

  return (
    <nav aria-label="Sections" className="reveal-dots">
      {sections.map((s) => {
        const active = activeId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.label}`}
            aria-current={active ? "true" : undefined}
            onClick={() => {
              const el = document.getElementById(s.id);
              if (!el) return;
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiveId(s.id);
            }}
            className="reveal-dot"
          >
            <span aria-hidden="true" className="reveal-dot__mark" />
          </button>
        );
      })}
    </nav>
  );
}
