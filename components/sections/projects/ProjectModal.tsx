"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getBackgroundPath } from "@/components/layout/path-memory";
import { useReducedMotion } from "@/lib/motion";
import {
  canMorph,
  findCardMorphImg,
  transitionOrUpdate,
  untagMorph,
} from "@/lib/view-transitions";

type Props = {
  children: ReactNode;
  backHref: string;
  marker?: string;
  initialMedia?: string;
  /** Project id — used to re-tag the originating card so close morphs back. */
  projectId?: string;
};

type LenisScroll = {
  scrollTo?: (target: HTMLElement | number, opts?: Record<string, unknown>) => void;
  stop?: () => void;
  start?: () => void;
};

/**
 * Lenis owns the window scroll position — a native scrollIntoView desyncs its
 * virtual scroll and the page snaps back to the top (modal close landing on
 * the hero). Go through Lenis when present, native jump otherwise. Retried
 * because the modal exit fade (~250ms) + route swap delay the background
 * layout, and Lenis only restarts on modal cleanup.
 */
function scrollToHashId(hashId: string): void {
  for (const ms of [80, 350, 900]) {
    window.setTimeout(() => {
      const el = document.getElementById(hashId);
      if (!el) return;
      try {
        const lenis = (window as unknown as { __lenis?: LenisScroll }).__lenis;
        if (lenis?.scrollTo) {
          lenis.scrollTo(el, { offset: -80, duration: 1.1 });
          return;
        }
      } catch {
        // non-fatal: fall through to native scroll
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, ms);
  }
}
type ModalCtx = {
  activeMedia: string | null;
  setActiveMedia: (src: string | null) => void;
  isMobile: boolean;
  /** True when rendered inside the modal (vs. full detail page). */
  inModal: boolean;
};

const Ctx = createContext<ModalCtx>({ activeMedia: null, setActiveMedia: () => {}, isMobile: false, inModal: false });
export const useProjectModal = () => useContext(Ctx);

export function ProjectModal({ children, backHref, marker, initialMedia, projectId }: Props) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Background scroll insurance: Next's back-navigation restoration races
  // Lenis (stopped while the modal is open), so the position can be dropped
  // and the page lands on the hero. Record Y at open, restore-if-lost at close.
  const savedYRef = useRef(0);
  const backCloseRef = useRef(false);
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
    // Detail urls are /projects/<docId> slugs (not numeric) — the archive
    // page /projects itself is not a detail page.
    const isDetailBg = /^\/projects\/.+/.test(bgPathOnly);
    const navigate = (): void => {
      // History back preserves the exact background scroll (the page never
      // scrolled under the stopped Lenis), so it beats push + re-scroll for
      // every normal open — including "/" and "/#projects" backgrounds.
      // backCloseRef arms the unmount insurance below in case Next/Lenis
      // drop the position on the way back.
      if (bg && !isDetailBg && window.history.length > 1) {
        backCloseRef.current = true;
        router.back();
        return;
      }
      let target = bg && !isDetailBg ? bg : backHref;
      if (target === "/") target = "/#projects";
      const hashId = target.includes("#") ? target.split("#")[1] : "";
      // scroll:false: Next's native jump fights Lenis (virtual-scroll desync
      // snaps back to the top = "lands on hero"). scrollToHashId goes through
      // Lenis instead.
      router.push(target, { scroll: false });
      if (hashId) scrollToHashId(hashId);
    };
    // Shared-element close: re-tag the originating card so the modal hero
    // morphs back into it. No card (direct link open) or no VT support →
    // plain navigation; the Motion fade is the fallback either way.
    if (projectId && canMorph()) {
      const img = findCardMorphImg(projectId);
      if (img) {
        img.style.viewTransitionName = "project-morph";
        void transitionOrUpdate(navigate).finally(() => {
          untagMorph(img);
        });
        return;
      }
    }
    navigate();
  }, [router, backHref, projectId]);

  // Wheel over the side gutters (backdrop) would otherwise chain to the
  // window behind the modal. Forward it into the cinema scroller instead,
  // so wheel anywhere over the modal scrolls the modal, never the page.
  useEffect(() => {
    const outer = outerRef.current;
    const inner = scrollRef.current;
    if (!outer || !inner) return;
    const onWheel = (e: WheelEvent): void => {
      if (e.target instanceof Node && inner.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      inner.scrollTop += e.deltaY;
      inner.scrollLeft += e.deltaX;
    };
    outer.addEventListener("wheel", onWheel, { passive: false });
    return () => outer.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Same Lenis issue as BookingModal: body overflow doesn't stop Lenis,
    // so stop it while the project modal is open.
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    lenis?.stop();
    try {
      savedYRef.current = window.scrollY;
    } catch {
      // non-fatal: insurance restore just won't trigger
    }
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
      const lenis = (window as unknown as { __lenis?: LenisScroll }).__lenis;
      lenis?.start?.();
      // Back-close insurance: if the background position was lost on the way
      // back (hero instead of the projects section), jump straight back.
      // Prefers the click-time value (recorded before the open navigation
      // could clamp it); falls back to the mount-time capture. Only
      // catastrophic loss triggers (saved deep, now near top), so this
      // never fights an intentional user scroll. Retried because Next's
      // post-commit scroll can land after unmount.
      if (backCloseRef.current) {
        backCloseRef.current = false;
        let savedY = savedYRef.current;
        try {
          const raw = sessionStorage.getItem("project-modal-y");
          if (raw != null) {
            const n = Number(raw);
            if (Number.isFinite(n) && n > 0) savedY = n;
          }
        } catch {
          // non-fatal: keep the mount-time capture
        }
        if (savedY > 200) {
          const restore = (): void => {
            try {
              if (window.scrollY >= savedY - 120) return;
              const l = (window as unknown as { __lenis?: LenisScroll }).__lenis;
              if (l?.scrollTo) {
                l.scrollTo(savedY, { immediate: true, force: true });
                return;
              }
            } catch {
              // non-fatal: fall through to native scroll
            }
            try {
              window.scrollTo(0, savedY);
            } catch {
              // non-fatal: position stays where Next left it
            }
          };
          window.requestAnimationFrame(restore);
          window.setTimeout(restore, 150);
          window.setTimeout(restore, 450);
        }
      }
    };
  }, [close]);

  return (
    <motion.div
      ref={outerRef}
      role="dialog"
      aria-modal="true"
      data-marker={marker}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.25 }}
      className="fixed inset-0 z-[100] flex justify-center overflow-hidden overscroll-contain p-0 sm:p-4"
      style={{ fontFamily: "var(--font-body)", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      data-lenis-prevent
    >
      <Ctx.Provider value={{ activeMedia, setActiveMedia, isMobile, inModal: true }}>
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
        {/* ambient bleed - Mohand style */}
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
        {/* floating close - Mohand */}
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
          ref={scrollRef}
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
