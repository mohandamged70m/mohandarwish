"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

const DETAIL_PATTERN = /^\/projects\/.+/;
const STORAGE_KEY = "background-path";

let inMemoryPath = "/";

export function getBackgroundPath(): string {
  if (typeof window === "undefined") return inMemoryPath;
  return sessionStorage.getItem(STORAGE_KEY) ?? inMemoryPath;
}

/** Remembers the last non-detail route so the project modal can morph back to it. */
export function PathMemory(): ReactNode {
  const pathname = usePathname();

  useEffect(() => {
    const save = (): void => {
      try {
        const current = window.location.pathname;
        if (DETAIL_PATTERN.test(current)) return;
        const fullPath = `${current}${window.location.search}${window.location.hash}`;
        inMemoryPath = fullPath;
        sessionStorage.setItem(STORAGE_KEY, fullPath);
      } catch {
        // storage blocked — in-memory path still updates
      }
    };
    // usePathname excludes the hash, so anchor glides (/#projects) never
    // re-run this effect — without the listener the stored path stays "/"
    // and modal close can't tell hero apart from the projects section.
    save();
    window.addEventListener("hashchange", save);
    return () => window.removeEventListener("hashchange", save);
  }, [pathname]);

  return null;
}
