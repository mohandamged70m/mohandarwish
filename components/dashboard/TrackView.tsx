"use client";

import { useEffect } from "react";

// Fire-and-forget page-view ping for Trails (no PII, public POST).
// Legacy fallback: the global TrailsTracker (layout) covers every page;
// when it is active this skips so share-link visits aren't double-counted.
export function TrackView({ path }: { path?: string }) {
  useEffect(() => {
    try {
      if ((window as unknown as { __trails_active?: boolean }).__trails_active) return;
      const p = path ?? window.location.pathname;
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: p,
          referrer: document.referrer || "",
          screen: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          language: navigator.language || "",
        }),
      }).catch(() => {});
    } catch {
      // never break the page
    }
  }, [path]);
  return null;
}
