"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

function subscribeToReducedMotion(callback: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

const ReducedMotionContext = createContext<boolean>(false);

export function useReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}

// Preview escape hatch: ?motion=full (persisted as localStorage md-motion)
// lets the owner see the pager curtain + slide on a machine with OS-level
// reduced-motion on. Default visitors still respect the OS setting.
export function isMotionForced(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    const q = url.searchParams.get("motion");
    if (q === "full" || q === "1") {
      try {
        window.localStorage.setItem("md-motion", "full");
      } catch {
        // storage blocked — query param still applies to this load
      }
      // Strip the flag so the address bar (and any copied/shared URL)
      // stays canonical — the localStorage value keeps it persisted.
      // replaceState never triggers a navigation.
      try {
        url.searchParams.delete("motion");
        const rest = url.searchParams.toString();
        window.history.replaceState(
          null,
          "",
          url.pathname + (rest ? `?${rest}` : "") + url.hash
        );
      } catch {
        // non-fatal: flag just stays visible in the URL
      }
      return true;
    }
    return window.localStorage.getItem("md-motion") === "full";
  } catch {
    return false;
  }
}

export function ReducedMotionProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <ReducedMotionContext.Provider value={prefersReducedMotion}>
      {children}
    </ReducedMotionContext.Provider>
  );
}
