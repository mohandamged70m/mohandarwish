"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isVideoFile } from "@/lib/project-utils";
import { VideoPlayer } from "./VideoPlayer";

type Props = {
  media: string[];
  onIndexChange?: (idx: number) => void;
  isMobile: boolean;
};

function ProjectMediaImage({ src }: { src: string }) {
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
          transition: "opacity 1s ease-out",
          overflow: "hidden",
        }}
      >
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
              animation: "shimmer-fast 0.6s infinite ease-in-out",
            }}
          />
        )}
      </div>
      <img
        src={src}
        onLoad={() => setLoaded(true)}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          inset: 0,
          zIndex: 1,
          filter: loaded ? "blur(0px)" : "blur(20px)",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "scale(1)" : "scale(1.05)",
          transition: "all 0.2s ease-out",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)", zIndex: 2 }} />
    </div>
  );
}

export function ProjectMediaCarousel({ media, onIndexChange, isMobile }: Props) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const sorted = media; // already sorted caller side (videos first if provided)

  useEffect(() => {
    onIndexChange?.(current);
  }, [current, onIndexChange]);

  useEffect(() => {
    if (sorted.length <= 1) return;
    const cur = sorted[current];
    const isVid = cur ? isVideoFile(cur) : false;
    if (isVid || isHovered) return;
    const id = window.setInterval(() => {
      setCurrent((p) => (p + 1) % sorted.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [sorted, current, isHovered]);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((p) => (p - 1 + sorted.length) % sorted.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent((p) => (p + 1) % sorted.length);
  };

  if (sorted.length === 0) return null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        height: "auto",
        aspectRatio: "16 / 9",
        maxHeight: "80vh",
        borderRadius: isMobile ? "16px" : "32px",
        overflow: "hidden",
        background: "#000",
        willChange: "transform",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {sorted.map((src, i) => (
          <div
            key={`${src}-${i}`}
            style={{
              position: "absolute",
              inset: 0,
              opacity: i === current ? 1 : 0,
              transform: i === current ? "scale(1)" : "scale(1.08)",
              transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
              pointerEvents: i === current ? "auto" : "none",
              zIndex: i === current ? (isVideoFile(src) ? 3 : 1) : 0,
            }}
          >
            {isVideoFile(src) ? <VideoPlayer src={src} isActive={i === current} isMobile={isMobile} /> : <ProjectMediaImage src={src} />}
          </div>
        ))}
      </div>

      {sorted.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: isMobile ? "6px" : "24px",
              top: "50%",
              transform: "translateY(-50%)",
              width: isMobile ? "34px" : "54px",
              height: isMobile ? "34px" : "54px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 8,
            }}
          >
            <ChevronLeft size={isMobile ? 16 : 22} />
          </button>
          <button
            onClick={next}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: isMobile ? "6px" : "24px",
              top: "50%",
              transform: "translateY(-50%)",
              width: isMobile ? "34px" : "54px",
              height: isMobile ? "34px" : "54px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 8,
            }}
          >
            <ChevronRight size={isMobile ? 16 : 22} />
          </button>
        </>
      )}

      {!isMobile && sorted.length > 1 && (
        <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, zIndex: 9 }}>
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? "36px" : "10px",
                height: 8,
                borderRadius: 999,
                background: "white",
                opacity: i === current ? 1 : 0.3,
                cursor: "pointer",
                transition: "all 0.4s",
                border: "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
