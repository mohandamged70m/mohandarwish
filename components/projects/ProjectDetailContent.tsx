"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Code, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/Data/projects";
import { getTechColor, isVideoFile } from "@/lib/project-utils";
import { GlassPanel } from "./GlassPanel";
import { ProjectMediaCarousel } from "./ProjectMediaCarousel";
import { useProjectModal } from "./ProjectModal";

const isRealUrl = (url?: string) => Boolean(url) && url !== "#";

type Props = { project: Project };

export function ProjectDetailContent({ project }: Props) {
  const { setActiveMedia, isMobile } = useProjectModal();
  const [windowWidth, setWindowWidth] = useState(1024);

  useEffect(() => {
    const onR = () => setWindowWidth(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const media: string[] = (() => {
    const vids = project.videos ?? [];
    const imgs = project.images ?? [project.image];
    // videos first like Revil
    const all = [...vids, ...imgs];
    // dedupe
    return Array.from(new Set(all));
  })();

  const displayTitle = project.title.toUpperCase();
  const isTiny = windowWidth < 480;

  useEffect(() => {
    // init ambient
    const first = media.find((m) => !isVideoFile(m)) ?? media[0];
    if (first) setActiveMedia(first);
  }, [media, setActiveMedia]);

  const handleIndexChange = (idx: number) => {
    const src = media[idx];
    if (src && !isVideoFile(src)) setActiveMedia(src);
  };

  return (
    <div className="flex w-full flex-col">
      {/* HERO SHOWCASE 100vh */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100vh",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? 16 : 20,
        }}
      >
        {/* Watermark */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: isMobile ? "18vw" : "11vw",
            fontWeight: 950,
            color: "white",
            opacity: isMobile ? 0.025 : 0.035,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 0,
            userSelect: "none",
            letterSpacing: "-0.07em",
            lineHeight: 1,
            fontFamily: "var(--font-heading)",
          }}
        >
          {displayTitle}
        </div>

        {/* Spotlight card wrapper */}
        <div
          style={{
            position: "relative",
            width: isMobile ? "100%" : "85%",
            maxWidth: 1200,
            maxHeight: "80vh",
            zIndex: 1,
            borderRadius: isMobile ? 16 : 32,
            boxShadow: "0 50px 100px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              borderRadius: isMobile ? 16 : 32,
              overflow: "hidden",
              background: "#000",
            }}
          >
            <ProjectMediaCarousel media={media} onIndexChange={handleIndexChange} isMobile={isMobile} />
            {/* top badges overlay */}
            <div style={{ position: "absolute", left: 12, top: 12, display: "flex", gap: 8, zIndex: 9 }}>
              <Badge variant="default" className="bg-bg-surface/90 backdrop-blur border-white/10 text-[11px] px-2.5 py-1 shadow-sm text-white">
                {project.category}
              </Badge>
              {project.year && (
                <Badge variant="soft" className="text-[11px] px-2.5 py-1 shadow-sm">
                  {project.year}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: isMobile ? 18 : 30,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            color: "rgba(255,255,255,0.5)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "0.62rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.22em", fontFamily: "var(--font-heading)" }}>
            Scroll for more
          </span>
          <div style={{ width: 24, height: 42, borderRadius: 15, border: "2px solid rgba(255,255,255,0.2)", display: "flex", justifyContent: "center", padding: 6 }}>
            <div style={{ width: 2, height: 8, borderRadius: 2, background: "var(--accent-primary)", animation: "scrollWheel 1.5s ease-in-out infinite", boxShadow: "0 0 10px var(--accent-primary)" }} />
          </div>
        </div>
      </div>

      {/* CONTENT MATRIX */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.8fr 1fr",
          gap: isMobile ? 20 : 32,
          position: "relative",
          zIndex: 2,
          padding: isMobile ? "14px 14px 28px" : "0 0 60px 0",
          marginTop: isMobile ? 0 : 28,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 20 : 32 }}>
          <GlassPanel>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "6px 14px",
                  background: "rgba(163,230,53,0.15)",
                  color: "var(--accent-primary)",
                  borderRadius: 999,
                  fontSize: "0.7rem",
                  fontWeight: 950,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily: "var(--font-heading)",
                }}
              >
                More Details
              </span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-heading)" }}>
                Project ID: #{project.id.toUpperCase()}
              </span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? (isTiny ? "1.9rem" : "2.6rem") : "4.2rem",
                fontWeight: 950,
                color: "white",
                letterSpacing: "-0.05em",
                lineHeight: 0.95,
                marginBottom: 18,
                textTransform: "uppercase",
                fontFamily: "var(--font-heading)",
              }}
            >
              {displayTitle}
            </h1>
            {project.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? "1.05rem" : "1.2rem",
                  lineHeight: 1.65,
                  color: "rgba(255,255,255,0.75)",
                  fontWeight: 400,
                  borderLeft: "3px solid var(--accent-primary)",
                  paddingLeft: 18,
                }}
              >
                {project.description}
              </p>
            )}
            {project.problem && (
              <div style={{ marginTop: 18, borderRadius: 16, border: "1px solid rgba(163,230,53,0.18)", background: "rgba(163,230,53,0.06)", padding: "14px 16px" }}>
                <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-primary)", marginBottom: 6, fontWeight: 800 }}>Problem</p>
                <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.6, color: "rgba(255,255,255,0.82)" }}>{project.problem}</p>
              </div>
            )}
            {project.role && (
              <p style={{ margin: "16px 0 0", fontFamily: "var(--font-heading)", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                <span style={{ color: "white", fontWeight: 600 }}>Role:</span> {project.role}
              </p>
            )}
          </GlassPanel>

          <GlassPanel>
            <h3 style={{ margin: "0 0 22px 0", fontSize: "0.8rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--accent-primary)", fontFamily: "var(--font-heading)" }}>
              Technological Blueprint
            </h3>
            {project.stack && project.stack.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 170}px, 1fr))`, gap: 12 }}>
                {project.stack.map((tech) => {
                  const color = getTechColor(tech);
                  return (
                    <div
                      key={tech}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        background: `${color}14`,
                        borderRadius: 20,
                        border: `1px solid ${color}33`,
                        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${color}22`;
                        e.currentTarget.style.borderColor = color;
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = `0 10px 20px -10px ${color}88`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${color}14`;
                        e.currentTarget.style.borderColor = `${color}33`;
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}`, flexShrink: 0 }} />
                      <span style={{ fontSize: isMobile ? "0.85rem" : "0.92rem", fontWeight: 800, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-heading)" }}>{tech}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>No stack listed.</p>
            )}

            {project.highlights && project.highlights.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {project.highlights.map((h) => (
                  <li key={h} style={{ display: "flex", gap: 10, fontSize: "0.92rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
                    <span style={{ marginTop: 7, width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", flexShrink: 0 }} />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 20 : 24 }}>
          <GlassPanel style={{ padding: isMobile ? 18 : 24 }}>
            <h4 style={{ margin: "0 0 16px 0", fontFamily: "var(--font-heading)", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Actions</h4>
            {(isRealUrl(project.liveUrl) || isRealUrl(project.githubUrl)) ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {isRealUrl(project.liveUrl) && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 999,
                      background: "var(--accent-primary)",
                      color: "var(--text-on-accent)",
                      padding: "14px 16px",
                      fontFamily: "var(--font-heading)",
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      textDecoration: "none",
                      boxShadow: "0 0 20px var(--accent-ring)",
                      gridColumn: isRealUrl(project.githubUrl) ? "span 1" : "span 2",
                    }}
                  >
                    Live demo <ArrowUpRight size={16} />
                  </a>
                )}
                {isRealUrl(project.githubUrl) && (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      padding: "14px 16px",
                      fontFamily: "var(--font-heading)",
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    <Code size={16} /> Source
                  </a>
                )}
              </div>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", padding: "12px 16px", fontFamily: "var(--font-heading)", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                <ExternalLink size={14} /> Links coming soon
              </span>
            )}
            {(isRealUrl(project.liveUrl) || isRealUrl(project.githubUrl)) && (
              <p style={{ margin: "10px 0 0", fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Check live or source</p>
            )}
          </GlassPanel>

          {project.metrics && project.metrics.length > 0 && (
            <GlassPanel style={{ padding: isMobile ? 18 : 24 }}>
              <h4 style={{ margin: "0 0 14px 0", fontFamily: "var(--font-heading)", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Impact</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {project.metrics.map((m) => (
                  <div key={m.label} style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "14px 14px" }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.5)" }}>{m.label}</p>
                    <p style={{ margin: "6px 0 0", fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 800, color: "white" }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}

          <GlassPanel style={{ padding: isMobile ? 18 : 24 }}>
            <h4 style={{ margin: "0 0 10px 0", fontFamily: "var(--font-heading)", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Details</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.88rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
              <div><span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>Category:</span> {project.category}</div>
              {project.year && <div><span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>Year:</span> {project.year}</div>}
              <div><span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>ID:</span> {project.id}</div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
