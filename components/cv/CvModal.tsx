"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Download, ExternalLink, FileText, Mail, MapPin, X } from "lucide-react";
import { ME } from "@/Data/me";

type Props = {
  open: boolean;
  onClose: () => void;
};

const EXPERIENCE = [
  {
    company: "Freelance",
    role: "Frontend Engineer (Full-Stack)",
    period: "Jan 2023 — Present",
    points: [
      "Shipping Next.js + TypeScript + Node apps with clean architecture.",
      "Performance, accessibility and DX as default — not follow-ups.",
    ],
  },
  {
    company: "Open Source",
    role: "Contributor — Design System & Tooling",
    period: "Jun 2022 — Present",
    points: ["Design-system components, tooling and docs contributions."],
  },
  {
    company: "Studio Intern",
    role: "Frontend Intern",
    period: "Jun 2021 — May 2022",
    points: ["Production UI work, component APIs and responsive layouts."],
  },
];

const EDUCATION = [
  {
    school: "Alexandria University",
    degree: "B.Sc. Computer Engineering — Frontend & Systems focus",
    period: "2019 – 2023",
  },
  {
    school: "ALX / Holberton",
    degree: "Advanced Frontend & Backend (React, Node)",
    period: "2022 – 2023",
  },
];

const SKILLS = [
  "React / Next.js",
  "TypeScript",
  "Tailwind / Storybook",
  "Node / tRPC / Prisma",
  "Performance & Web Vitals",
  "Accessibility (a11y)",
  "Testing (Playwright / Vitest)",
  "System Design",
  "Design Systems",
];

export function openCvModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-cv"));
  }
}

export function CvModal({ open, onClose }: Props): ReactNode {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevOverflowRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflowRef.current;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 1400,
        }}
      />
      <div
        className="fixed inset-0 z-[1401] flex items-center justify-center p-4 pointer-events-none"
        style={{ overscrollBehavior: "contain" }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-modal-title"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 24 }}
          transition={{ type: "spring", damping: 30, stiffness: 350, mass: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel-deep pointer-events-auto flex flex-col overflow-hidden"
          style={{
            width: "min(720px, 94vw)",
            height: "min(780px, 90dvh)",
            maxHeight: "90dvh",
            borderRadius: "24px",
            willChange: "transform, opacity",
          }}
        >
          {/* header */}
          <div
            className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 sm:px-8"
            style={{ paddingBottom: 16, borderBottom: "1px solid var(--section-border)" }}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)",
                  color: "var(--accent-primary)",
                }}
              >
                <FileText size={20} />
              </span>
              <div>
                <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Curriculum Vitae
                </p>
                <h2 id="cv-modal-title" className="font-heading text-xl font-bold tracking-tight text-text-primary">
                  {ME.name}
                </h2>
                <p className="font-body text-[13px] text-text-secondary">{ME.role}</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close CV"
              className="btn-icon rounded-full focus-ring shrink-0 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* written CV body */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-2 font-body text-[13px] text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {ME.location} · {ME.timezone}
              </span>
              <span aria-hidden="true" className="text-border-strong">·</span>
              <a href={`mailto:${ME.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Mail size={14} aria-hidden="true" />
                {ME.email}
              </a>
            </div>

            <p className="mt-4 font-body text-[14px] leading-relaxed text-text-secondary">
              {ME.tagline} {ME.availability}.
            </p>

            <section aria-label="Experience" className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-text-primary">
                Experience
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {EXPERIENCE.map((job) => (
                  <li
                    key={`${job.company}-${job.period}`}
                    className="rounded-2xl border border-border bg-bg-primary p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading text-[15px] font-semibold text-text-primary">
                        {job.role} — {job.company}
                      </p>
                      <span className="font-body text-[12px] tabular-nums text-text-muted">{job.period}</span>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 font-body text-[13.5px] leading-relaxed text-text-secondary">
                      {job.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Education" className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-text-primary">
                Education
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {EDUCATION.map((ed) => (
                  <li
                    key={`${ed.school}-${ed.period}`}
                    className="rounded-2xl border border-border bg-bg-primary p-4"
                  >
                    <p className="font-heading text-[15px] font-semibold text-text-primary">{ed.school}</p>
                    <p className="mt-0.5 font-body text-[13.5px] text-text-secondary">
                      {ed.degree} <span className="text-text-muted">· {ed.period}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Skills" className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-text-primary">
                Skills
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {SKILLS.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-border bg-bg-primary px-3 py-1.5 font-body text-[13px] text-text-secondary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>

            <section aria-label="Links" className="mt-6">
              <h3 className="font-heading text-sm font-bold uppercase tracking-[0.12em] text-text-primary">
                Links
              </h3>
              <div className="mt-3 flex flex-wrap gap-2 font-body text-[13px]">
                <a
                  href={ME.socials.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-text-secondary hover:text-accent"
                >
                  <ExternalLink size={14} aria-hidden="true" /> LinkedIn
                </a>
                <a
                  href={ME.socials.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-text-secondary hover:text-accent"
                >
                  <ExternalLink size={14} aria-hidden="true" /> GitHub
                </a>
              </div>
            </section>
          </div>

          {/* footer */}
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-8"
            style={{ borderTop: "1px solid var(--section-border)" }}
          >
            <p className="font-body text-[12px] text-text-muted">Written version — same content as the PDF.</p>
            <a
              href={ME.cvUrl}
              download
              className="btn-primary btn focus-ring inline-flex cursor-pointer items-center gap-2"
              style={{ padding: "10px 18px", borderRadius: "14px" }}
            >
              <Download size={16} aria-hidden="true" />
              Download PDF
            </a>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
}
