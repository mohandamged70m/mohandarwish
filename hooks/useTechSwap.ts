"use client";

import { useEffect, useState } from "react";

/**
 * Shared tech-badge swap timer.
 *
 * Call ONCE in the parent grid — never inside each card — so every
 * <ProjectCard /> flips between photo and tech chips at the same time.
 * Returns the shared `showTech` boolean to pass down to each card.
 *
 * Cleans up its single setInterval on unmount.
 */
export function useTechSwap(intervalMs = 5000): boolean {
  const [showTech, setShowTech] = useState(false);

  useEffect(() => {
    try {
      // Static badge for reduced-motion users — no flip timer at all.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      // matchMedia unavailable — keep the timer.
    }
    const id = window.setInterval(() => {
      // Skip pointless flips (and re-renders) while the tab is hidden.
      if (document.hidden) return;
      setShowTech((v) => !v);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return showTech;
}
