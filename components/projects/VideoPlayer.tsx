"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pause, Play, Volume2, VolumeX, Maximize } from "lucide-react";

type Props = {
  src: string;
  isActive: boolean;
  isMobile: boolean;
  style?: React.CSSProperties;
};

export const VideoPlayer = React.memo(function VideoPlayer({ src, isActive, isMobile, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && playing) {
        videoRef.current?.pause();
        setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    const v = videoRef.current;
    if (!v) return;
    const run = async () => {
      try {
        if (isActive) {
          if (v.paused) await v.play();
          if (cancelled) v.pause();
        } else {
          v.pause();
          v.currentTime = 0;
          setUserInteracted(false);
          setMuted(true);
          setPlaying(true);
        }
      } catch {
        // AbortError ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (!userInteracted) {
        v.currentTime = 0;
        setUserInteracted(true);
      }
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    if (!next && !userInteracted) {
      v.currentTime = 0;
      setUserInteracted(true);
      v.play().catch(() => {});
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || isDragging) return;
    if (!v.paused && !playing) setPlaying(true);
    if (v.paused && playing) setPlaying(false);
    if (!userInteracted && v.currentTime >= 3) v.currentTime = 0;
    setProgress((v.currentTime / (v.duration || 1)) * 100);
  };

  const handleScrub = (e: React.MouseEvent | React.TouchEvent) => {
    const container = (e.currentTarget as HTMLElement).closest('[data-testid="progress-container"]');
    if (!container || !videoRef.current) return;
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? (e as unknown as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    videoRef.current.currentTime = ratio * videoRef.current.duration;
    setProgress(ratio * 100);
    if (!userInteracted) setUserInteracted(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const c = document.querySelector('[data-testid="progress-container"]') as HTMLElement | null;
      if (!c || !videoRef.current) return;
      const r = c.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
      const ratio = x / r.width;
      videoRef.current.currentTime = ratio * videoRef.current.duration;
      setProgress(ratio * 100);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else document.exitFullscreen?.();
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0, ...style }}>
      <video
        ref={videoRef}
        src={src}
        loop={userInteracted}
        muted={muted}
        playsInline
        autoPlay
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          cursor: "pointer",
          display: "block",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)", pointerEvents: "none", zIndex: 2 }} />
      <AnimatePresence>
        {isActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
              <AnimatePresence>
                {(!userInteracted || !playing) && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.15)" }}
                    style={{
                      width: isMobile ? "54px" : "80px",
                      height: isMobile ? "54px" : "80px",
                      background: "rgba(255,255,255,0.08)",
                      backdropFilter: "blur(32px)",
                      WebkitBackdropFilter: "blur(32px)",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "auto",
                      cursor: "pointer",
                      zIndex: 6,
                      boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                    }}
                    onClick={togglePlay}
                  >
                    <span style={{ marginLeft: isMobile ? "3px" : "5px" }}>
                      <Play size={isMobile ? 22 : 32} fill="white" strokeWidth={1.5} />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: isMobile ? "12px" : "20px",
                left: 0,
                right: 0,
                padding: isMobile ? "0 12px" : "0 25px",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? "6px" : "8px",
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <div
                style={{
                  width: "100%",
                  background: isMobile ? "transparent" : "rgba(255,255,255,0.1)",
                  backdropFilter: isMobile ? "none" : "blur(24px)",
                  borderRadius: isMobile ? "0" : "16px",
                  border: isMobile ? "none" : "1px solid rgba(255,255,255,0.15)",
                  padding: isMobile ? "0" : "0 20px",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "auto",
                  height: isMobile ? "20px" : "32px",
                  cursor: "pointer",
                }}
                data-testid="progress-container"
                onMouseDown={(e) => {
                  setIsDragging(true);
                  handleScrub(e as unknown as React.MouseEvent);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    flex: 1,
                    height: isMobile ? "3px" : "5px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #a3e635 0%, #84cc16 100%)",
                      boxShadow: "0 0 15px rgba(163,230,53,0.4)",
                      transition: isDragging ? "none" : "width 0.1s linear",
                      borderRadius: 4,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `${progress}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 16,
                      height: 16,
                      background: "white",
                      borderRadius: "50%",
                      boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                      opacity: isDragging ? 1 : 0,
                      transition: "opacity 0.2s",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: isMobile ? "space-between" : "flex-end", alignItems: "center" }}>
                {!isMobile && (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      backdropFilter: "blur(24px)",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "auto",
                      height: 40,
                      width: 60,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={togglePlay}
                      aria-label={userInteracted && playing ? "Pause video" : "Play video"}
                      style={{ width: "100%", height: "100%", background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {userInteracted && playing ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
                    </button>
                  </div>
                )}
                <div
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(24px)",
                    borderRadius: isMobile ? 12 : 16,
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "auto",
                    height: isMobile ? 36 : 40,
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isMobile && (
                    <button
                      onClick={togglePlay}
                      aria-label={userInteracted && playing ? "Pause video" : "Play video"}
                      style={{ height: "100%", padding: "0 12px", background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {userInteracted && playing ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                    </button>
                  )}
                  <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <button
                      onClick={toggleMute}
                      aria-label={muted ? "Unmute video" : "Mute video"}
                      style={{ height: "100%", padding: "0 12px", background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      aria-label="Toggle fullscreen"
                      style={{ height: "100%", padding: "0 12px", background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Maximize size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
