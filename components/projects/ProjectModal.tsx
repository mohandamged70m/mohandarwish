"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackgroundPath } from "@/components/layouts/path-memory";
import { useReducedMotion } from "@/lib/motion";

type Props = {
  children: ReactNode;
  backHref: string;
  marker?: string;
  initialMedia?: string;
};

type ModalCtx = {
  activeMedia: string | null;
  setActiveMedia: (src: string | null) => void;
  isMobile: boolean;
};

const Ctx = createContext<ModalCtx>({ activeMedia: null, setActiveMedia: () => {}, isMobile: false });
export const useProjectModal = () => useContext(Ctx);

export function ProjectModal({ children, backHref, marker, initialMedia }: Props) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMedia, setActiveMedia] = useState<string | null>(initialMedia ?? null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (initialMedia) setActiveMedia(initialMedia);
  }, [initialMedia]);

  const close = useCallback(() => {
    const bg = getBackgroundPath();
    const bgPathOnly = (bg?.split("?")[0]?.split("#")[0]) ?? "";
    const isDetailBg = /^\/projects\/p\d+$/.test(bgPathOnly);
    if (bg && !isDetailBg && bg !== "/" && bg !== "/#projects" && window.history.length > 1) {
      router.back();
      return;
    }
    let target = bg && !isDetailBg ? bg : backHref;
    if (target === "/") target = "/#projects";
    const hasHash = target.includes("#");
    if (hasHash) {
      router.push(target);
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      data-marker={marker}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.25 }}
      className="fixed inset-0 z-[100] flex justify-center overflow-y-auto overscroll-contain p-0 sm:p-4"
      style={{ fontFamily: "var(--font-body)", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      data-lenis-prevent
    >
      <Ctx.Provider value={{ activeMedia, setActiveMedia, isMobile }}>
        {/* backdrop */}
        <motion.div
          aria-hidden
          onClick={close}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 bg-black/85"
          style={{ backdropFilter: "blur(2px)" }}
        />
        {/* ambient bleed - Revil style */}
        {activeMedia && !isVideo(activeMedia) && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -50,
              backgroundImage: `url(${activeMedia})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(80px) brightness(0.35)",
              opacity: 0.7,
              transition: "background-image 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
              zIndex: -1,
            }}
          />
        )}
        {/* floating close - Revil */}
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close project details"
          className="fixed z-[110] inline-flex items-center justify-center rounded-full border text-white cursor-pointer focus-ring outline-none"
          style={{
            top: isMobile ? 16 : 28,
            right: isMobile ? 16 : 28,
            width: isMobile ? 44 : 56,
            height: isMobile ? 44 : 56,
            background: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(10px)",
            transition: "all 0.3s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#ef4444";
            e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.transform = "scale(1) rotate(0deg)";
          }}
        >
          <X size={isMobile ? 20 : 24} />
        </button>

        {/* cinema container - 90vw/90vh - this is the scroll container */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          data-lenis-prevent
          className="relative flex w-full flex-col overflow-y-auto overscroll-contain focus-ring outline-none cinema-scroll my-auto"
          style={{
            width: isMobile ? "100%" : "90vw",
            height: isMobile ? "100dvh" : "90vh",
            maxHeight: isMobile ? "100dvh" : "90vh",
            maxWidth: isMobile ? "100%" : 1500,
            flexShrink: 0,
            borderRadius: isMobile ? 0 : 24,
            background: "transparent",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
          } as React.CSSProperties}
        >
          <div style={{ width: "100%", flexShrink: 0 }}>
            {children}
          </div>
        </motion.div>
      </Ctx.Provider>
    </motion.div>
  );
}

function isVideo(src: string) {
  const clean = src.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov)$/.test(clean) || src.includes("/videos/");
}
