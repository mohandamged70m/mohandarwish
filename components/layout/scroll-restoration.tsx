"use client";

import { useEffect, useLayoutEffect } from "react";

// useLayoutEffect on the client (runs before paint, so no scroll flash),
// useEffect on the server (avoids the SSR "useLayoutEffect does nothing" warning).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Replaces the old `next/script beforeInteractive` inline snippet.
 * An inline <script> inside a React tree triggers React 19's
 * "Encountered a script tag while rendering React component" warning
 * because client-inserted scripts never execute. Setting
 * history.scrollRestoration in a layout effect + jumping to top on
 * fresh loads (no #hash) achieves the same result with no warning.
 */
export function ScrollRestorationFix(): null {
  useIsomorphicLayoutEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // non-fatal: older browsers may not support scrollRestoration
    }
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  return null;
}
