"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { getBackgroundPath } from "@/components/layouts/path-memory";

type Props = {
  children: ReactNode;
  backHref: string;
  marker?: string;
};

export function ProjectModal({ children, backHref, marker }: Props) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    const bg = getBackgroundPath();
    const bgPathOnly = (bg?.split("?")[0]?.split("#")[0]) ?? "";
    const isDetailBg = /^\/projects\/p\d+$/.test(bgPathOnly);
    // If we have a meaningful background with history, prefer back() to preserve scroll/filter state
    if (bg && !isDetailBg && bg !== "/" && bg !== "/#projects" && window.history.length > 1) {
      router.back();
      return;
    }
    // Prefer stored background, but ensure it is not the current detail route
    let target = bg && !isDetailBg ? bg : backHref;
    // When background is root "/" (no hash), normalize to projects section anchor
    if (target === "/") target = "/#projects";
    const hasHash = target.includes("#");
    if (hasHash) {
      router.push(target);
      // Ensure anchor scroll after navigation (Next may delay it)
      const hashId = target.split("#")[1];
      if (hashId) {
        window.setTimeout(() => {
          document.getElementById(hashId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    } else {
      router.push(target, { scroll: false });
    }
  }, [router, backHref]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-marker={marker}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
    >
      <motion.div
        aria-hidden
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-y-auto rounded-[20px] border border-border bg-bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.6)] focus-ring outline-none"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close project details"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface/90 text-text-primary shadow-md backdrop-blur transition-colors duration-300 hover:border-accent/40 hover:text-accent focus-ring outline-none cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {children}
      </motion.div>
    </div>
  );
}
