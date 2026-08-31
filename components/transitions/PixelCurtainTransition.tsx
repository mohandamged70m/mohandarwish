"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";

type Props = {
  isTransitioning: boolean;
  onCurtainCovered: () => void;
  onTransitionComplete: () => void;
  nextSectionName?: string;
  direction?: number;
  gridSize?: number;
  pixelColor?: string;
  animationStepDuration?: number;
};

export default function PixelCurtainTransition({
  isTransitioning,
  onCurtainCovered,
  onTransitionComplete,
  nextSectionName = "",
  direction = 0,
  gridSize = 20,
  pixelColor = "var(--accent-primary)",
  animationStepDuration = 0.42,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef<HTMLDivElement[]>([]);
  const [fontSize, setFontSize] = useState(72);

  const displayName = nextSectionName ? nextSectionName.charAt(0).toUpperCase() + nextSectionName.slice(1) : "";

  useEffect(() => {
    const update = () => setFontSize(Math.max(36, Math.min(window.innerWidth / 10, 84)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // build grid once per mount / gridSize change
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.innerHTML = "";
    pixelsRef.current = [];
    const cols = gridSize;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = vw / vh;
    const rows = Math.max(10, Math.round(cols / aspect * 1.1));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const el = document.createElement("div");
        el.className = "pixel-curtain__pixel";
        el.style.backgroundColor = pixelColor;
        el.style.position = "absolute";
        el.style.display = "none";
        const w = 100 / cols;
        const h = 100 / rows;
        el.style.width = `calc(${w}% + 1px)`;
        el.style.height = `calc(${h}% + 1px)`;
        el.style.left = `${col * w}%`;
        el.style.top = `${row * h}%`;
        el.style.willChange = "transform, opacity";
        grid.appendChild(el);
        pixelsRef.current.push(el);
      }
    }
  }, [gridSize, pixelColor]);

  useEffect(() => {
    if (!isTransitioning) return;
    const pixels = pixelsRef.current;
    const overlay = overlayRef.current;
    const label = labelRef.current;
    if (!pixels.length || !overlay) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      onCurtainCovered();
      // tiny delay then complete
      const t = window.setTimeout(() => onTransitionComplete(), 60);
      return () => window.clearTimeout(t);
    }

    const total = pixels.length;
    const staggerCover = animationStepDuration / total;
    const staggerReveal = animationStepDuration / total;

    // ensure overlay visible
    overlay.style.display = "block";
    overlay.style.pointerEvents = "auto";
    gsap.killTweensOf(pixels);
    gsap.set(pixels, { display: "none", opacity: 1 });
    if (label) {
      gsap.set(label, { opacity: 0, y: 8, filter: "blur(6px)" });
    }

    // PHASE 1 — COVER: pixels appear in random stagger (like React Bits)
    gsap.to(pixels, {
      display: "block",
      duration: 0,
      stagger: { each: staggerCover, from: "random" },
    });

    // label fades in shortly after cover starts, during hold
    if (label && displayName) {
      gsap.to(label, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.35,
        delay: animationStepDuration * 0.55,
        ease: "power2.out",
      });
    }

    // When cover done -> swap section
    const coverDone = window.setTimeout(() => {
      onCurtainCovered();
    }, animationStepDuration * 1000 + 30);

    // hold 380ms then reveal (mirrors Revil: 400ms hold)
    const HOLD = 380;
    const revealTimer = window.setTimeout(() => {
      if (label) {
        gsap.to(label, {
          opacity: 0,
          y: -6,
          filter: "blur(6px)",
          duration: 0.22,
          ease: "power2.in",
        });
      }
      // PHASE 2 — REVEAL: pixels disappear in random stagger
      gsap.to(pixels, {
        display: "none",
        duration: 0,
        delay: 0,
        stagger: { each: staggerReveal, from: "random" },
      });

      const finishTimer = window.setTimeout(() => {
        overlay.style.display = "none";
        overlay.style.pointerEvents = "none";
        gsap.set(pixels, { display: "none" });
        onTransitionComplete();
      }, animationStepDuration * 1000 + 40);

      (overlay as unknown as { _ft?: number })._ft = finishTimer as unknown as number;
    }, animationStepDuration * 1000 + HOLD);

    return () => {
      window.clearTimeout(coverDone);
      window.clearTimeout(revealTimer);
      const ft = (overlay as unknown as { _ft?: number })._ft;
      if (ft) window.clearTimeout(ft);
      gsap.killTweensOf(pixels);
      if (label) gsap.killTweensOf(label);
    };
  }, [isTransitioning, onCurtainCovered, onTransitionComplete, displayName, animationStepDuration]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={overlayRef}
      aria-hidden
      className="fixed inset-0 z-[1000] overflow-hidden"
      style={{ display: "none", pointerEvents: "none" }}
    >
      {/* pixel grid */}
      <div ref={gridRef} className="absolute inset-0 overflow-hidden" />

      {/* subtle texture over pixels for depth (like Revil's blur curtain) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--border-strong) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* centered section name — pixel + Revil hybrid */}
      {displayName && (
        <div
          ref={labelRef}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        >
          <span
            className="font-heading font-black tracking-[-0.03em] text-text-primary text-center px-6"
            style={{
              fontSize,
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: "-0.04em",
              opacity: 0,
              textShadow: "0 2px 24px rgba(0,0,0,0.35)",
            }}
          >
            {displayName}
          </span>
        </div>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .pixel-curtain__pixel { display: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}
