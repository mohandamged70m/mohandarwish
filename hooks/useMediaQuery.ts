"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Starts at `false` on the server and on the first
 * client render, then follows the query's change events.
 */
export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    // Older Safari only has the deprecated listener pair.
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [query]);

  return matches;
}
