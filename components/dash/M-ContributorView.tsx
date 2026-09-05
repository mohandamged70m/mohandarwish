"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink } from "lucide-react";
import type { ContributorData } from "@/types";
import FileImage from "@/components/dash/FileImage";
import { Github, Linkedin, Facebook, Instagram } from "@/components/dash/icons";

export interface Contributor extends ContributorData {
  image?: string;
  links?: Record<string, string | undefined>;
}

interface Props {
  contributor: Contributor;
  onClose: () => void;
}

const LINK_ICONS: Record<string, (p: { size?: number; className?: string }) => React.ReactNode> = {
  github: Github,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
};

export default function MContributorView({ contributor, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const socials = contributor.socials ?? {};
  const links = contributor.links ?? {};
  const entries: { key: string; url: string }[] = [];
  for (const k of ["github", "linkedin", "facebook", "instagram", "portfolio"]) {
    const url = links[k] ?? (socials as Record<string, string | undefined>)[k];
    if (url) entries.push({ key: k, url });
  }

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
          className="w-full max-w-sm rounded-3xl border p-6 flex flex-col items-center gap-3 text-center"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)", boxShadow: "var(--card-shadow)" }}
        >
          <span className="w-20 h-20 rounded-full overflow-hidden grid place-items-center text-2xl font-bold" style={{ background: "var(--section-border)", color: "var(--text-muted)" }}>
            {contributor.image ? (
              <FileImage src={contributor.image} alt={contributor.name} className="w-full h-full object-cover" />
            ) : (
              contributor.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <h3 className="font-inter font-extrabold text-xl" style={{ color: "var(--text-primary)" }}>
              {contributor.name}
            </h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {contributor.jobTitle || contributor.role || "Contributor"}
            </p>
          </div>
          {entries.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {entries.map(({ key, url }) => {
                const Icon = LINK_ICONS[key];
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon !p-2.5 rounded-xl border"
                    style={{ borderColor: "var(--card-border)" }}
                    title={key}
                  >
                    {Icon ? <Icon size={16} /> : <ExternalLink size={16} />}
                  </a>
                );
              })}
            </div>
          )}
          <button onClick={onClose} className="btn-icon self-end" aria-label="Close">
            <X size={18} />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
