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
    const id = window.setInterval(() => {
      setShowTech((v) => !v);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return showTech;
}
