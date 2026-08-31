"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isVideoFile } from "@/lib/project-utils";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  media: string[];
  onIndexChange?: (idx: number) => void;
  isMobile: boolean;
};

function ProjectMediaImage({ src, index }: { src: string; index: number }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          backgroundColor: "rgba(255,255,255,0.05)",
          opacity: loaded ? 0 : 1,
          pointerEvents: "none",
          transition: "opacity 0.6s ease-out",
          overflow: "hidden",
        }}
      >
        {!loaded && (
          <div
            className="motion-safe:animate-[shimmer-fast_0.6s_infinite_ease-in-out]"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
            }}
          />
        )}
      </div>
      <img
        src={src}
        onLoad={() => setLoaded(true)}
        alt={`Project image ${index + 1}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          inset: 0,
          zIndex: 1,
          filter: loaded ? "blur(0px)" : "blur(20px)",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "scale(1)" : "scale(1.03)",
          transition: "opacity 0.35s ease-out, filter 0.35s ease-out, transform 0.35s ease-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)",
          zIndex: 2,
        }}
      />
    </div>
  );
}

export function ProjectMediaCarousel({ media, onIndexChange, isMobile }: Props) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const sorted = media;

  useEffect(() => {
    onIndexChange?.(current);
  }, [current, onIndexChange]);

  useEffect(() => {
    if (sorted.length <= 1) return;
    const cur = sorted[current];
    const isVid = cur ? isVideoFile(cur) : false;
    if (isVid || isHovered) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;
    const id = window.setInterval(() => {
      setCurrent((p) => (p + 1) % sorted.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [sorted, current, isHovered]);

  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrent((p) => (p - 1 + sorted.length) % sorted.length);
  }, [sorted.length]);

  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrent((p) => (p + 1) % sorted.length);
  }, [sorted.length]);

  // keyboard
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    },
    [prev, next]
  );

  if (sorted.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Project media"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="relative w-full h-auto overflow-hidden bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black max-h-[80vh] aspect-[16/9]"
      style={{
        borderRadius: isMobile ? "16px" : "20px",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {sorted.map((src, i) => (
          <div
            key={`${src}-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${sorted.length}`}
            aria-hidden={i !== current}
            style={{
              position: "absolute",
              inset: 0,
              opacity: i === current ? 1 : 0,
              transform: i === current ? "scale(1)" : "scale(1.02)",
              pointerEvents: i === current ? "auto" : "none",
              zIndex: i === current ? (isVideoFile(src) ? 3 : 1) : 0,
            }}
            className="motion-safe:transition-all motion-safe:duration-[400ms] motion-safe:ease-[0.22,1,0.36,1]"
          >
            {isVideoFile(src) ? <VideoPlayer src={src} isActive={i === current} isMobile={isMobile} /> : <ProjectMediaImage src={src} index={i} />}
          </div>
        ))}
      </div>

      {sorted.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black transition hover:bg-white/20 active:scale-95"
            style={{
              left: isMobile ? "8px" : "20px",
              width: isMobile ? "44px" : "48px",
              height: isMobile ? "44px" : "48px",
              zIndex: 8,
            }}
          >
            <ChevronLeft size={isMobile ? 18 : 20} aria-hidden="true" />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black transition hover:bg-white/20 active:scale-95"
            style={{
              right: isMobile ? "8px" : "20px",
              width: isMobile ? "44px" : "48px",
              height: isMobile ? "44px" : "48px",
              zIndex: 8,
            }}
          >
            <ChevronRight size={isMobile ? 18 : 20} aria-hidden="true" />
          </button>
        </>
      )}

      {sorted.length > 1 && (
        <div
          role="group"
          aria-label="Slide indicators"
          style={{
            position: "absolute",
            bottom: isMobile ? 12 : 18,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 8,
            zIndex: 9,
          }}
        >
          {sorted.map((_, i) => {
            const isActive = i === current;
            return (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1} of ${sorted.length}`}
                aria-current={isActive ? "true" : undefined}
                className="rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  width: isActive ? "28px" : "8px",
                  height: 8,
                  background: "white",
                  opacity: isActive ? 1 : 0.45,
                  cursor: "pointer",
                  border: "none",
                }}
              />
            );
          })}
        </div>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {current + 1} of {sorted.length}
      </span>
    </div>
  );
}
