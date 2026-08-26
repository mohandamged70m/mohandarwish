"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

const DETAIL_PATTERN = /^\/projects\/p\d+$/;
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
    if (!DETAIL_PATTERN.test(pathname)) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const fullPath = `${pathname}${search}${hash}`;
      inMemoryPath = fullPath;
      sessionStorage.setItem(STORAGE_KEY, fullPath);
    }
  }, [pathname]);

  return null;
}
