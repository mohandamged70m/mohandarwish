"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, Eye } from "lucide-react";
import type { ProjectData, ContributorData } from "@/types";
import FileImage from "@/components/dash/FileImage";
import { Github as GithubIcon } from "@/components/dash/icons";
import { sanitizeSvg } from "@/lib/sanitize";

export type ProjectViewData = ProjectData & { title: string; images: string[] };

interface Props {
  project: ProjectViewData;
  onClose: () => void;
  onContributorClick: (c: ContributorData) => void;
}

export default function MProjectView({ project, onClose, onContributorClick }: Props) {
  const [isDark, setIsDark] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const images = project.images ?? [];
  const tags = project.tags ?? [];
  const contributors = project.contributors ?? [];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1200] grid place-items-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[88vh] overflow-y-auto custom-scrollbar rounded-3xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)", boxShadow: "var(--card-shadow)" }}
        >
          {images.length > 0 && (
            <div className="relative w-full aspect-video overflow-hidden rounded-t-3xl" style={{ background: isDark ? "#000" : "#eee" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[imgIdx]} alt={project.title} className="w-full h-full object-cover" />
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      aria-label={`Image ${i + 1}`}
                      className="h-2 rounded-full cursor-pointer transition-all"
                      style={{ width: i === imgIdx ? 22 : 8, background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.5)" }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-inter font-extrabold text-2xl" style={{ color: "var(--text-primary)" }}>
                  {project.title || project.name}
                </h2>
                {(project.views || project.liveViews || project.githubViews) && (
                  <p className="text-xs mt-1 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <Eye size={13} /> {project.views ?? 0} views
                    {!!project.liveViews && <span>· {project.liveViews} live</span>}
                    {!!project.githubViews && <span>· {project.githubViews} repo</span>}
                  </p>
                )}
              </div>
              <button onClick={onClose} aria-label="Close" className="btn-icon shrink-0">
                <X size={18} />
              </button>
            </div>

            {project.description && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {project.description}
              </p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span
                    key={`${t.name}-${i}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
                    style={{
                      borderColor: t.color ? `${t.color}55` : "var(--card-border)",
                      background: t.color ? `${t.color}14` : "transparent",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t.iconSvg ? (
                      t.iconSvg.trim().startsWith("http") || t.iconSvg.trim().startsWith("data:image") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.iconSvg} alt="" className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 inline-flex" dangerouslySetInnerHTML={{ __html: sanitizeSvg(t.iconSvg) }} />
                      )
                    ) : (
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color || "var(--accent)" }} />
                    )}
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {contributors.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Contributors
                </p>
                <div className="flex flex-wrap gap-2">
                  {contributors.map((c, i) => (
                    <button
                      key={`${c.name}-${i}`}
                      onClick={() => onContributorClick(c)}
                      className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border cursor-pointer hover:opacity-80"
                      style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}
                    >
                      <span className="w-7 h-7 rounded-full overflow-hidden grid place-items-center text-[10px] font-bold" style={{ background: "var(--section-border)", color: "var(--text-muted)" }}>
                        {typeof c.image === "string" && c.image ? (
                          <FileImage src={c.image} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          c.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {project.liveLink && (
                <a href={project.liveLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary !py-2 !px-4 !text-sm">
                  <ExternalLink size={15} /> Live
                </a>
              )}
              {project.repoLink && (
                <a href={project.repoLink} target="_blank" rel="noopener noreferrer" className="btn !py-2 !px-4 !text-sm" style={{ background: "var(--input-bg)", color: "var(--text-primary)" }}>
                  <GithubIcon size={15} /> Repo
                </a>
              )}
              {project.downloadLink && (
                <a href={project.downloadLink} target="_blank" rel="noopener noreferrer" className="btn !py-2 !px-4 !text-sm" style={{ background: "var(--input-bg)", color: "var(--text-primary)" }}>
                  Download
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
