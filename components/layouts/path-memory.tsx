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
      inMemoryPath = pathname;
      sessionStorage.setItem(STORAGE_KEY, pathname);
    }
  }, [pathname]);

  return null;
}
