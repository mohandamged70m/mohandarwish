"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Download,
  FileText,
  Mail,
  MapPin,
  Printer,
  X,
} from "lucide-react";
import { ME } from "@/Data/me";

export const CV_OPEN_EVENT = "open-cv";

export function requestCvOpen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CV_OPEN_EVENT));
}

const EXPERIENCE = [
  {
    company: "Freelance",
    role: "Frontend Engineer (Full-Stack)",
    period: "Jan 2023 — Present",
    points: [
      "Ship Next.js + TypeScript + Node apps with clean architecture and strict perf / a11y budgets.",
      "Own design tokens, component APIs, tRPC routes and Postgres queries end-to-end.",
    ],
  },
  {
    company: "Open Source",
    role: "Contributor — Design System & Tooling",
    period: "Jun 2022 — Present",
    points: [
      "Contribute to design-system components, docs and frontend tooling.",
    ],
  },
  {
    company: "Studio Intern",
    role: "Frontend Intern",
    period: "Jun 2021 — May 2022",
    points: ["Built marketing and product UI in React with a focus on responsive craft."],
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

function CvPaper(): ReactNode {
  return (
    <div className="flex flex-col gap-7">
      {/* header */}
      <div className="flex flex-col gap-3">
        <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
          Curriculum Vitae
        </p>
        <h2
          id="cv-modal-title"
          className="font-display text-[clamp(1.6rem,1.1rem+2vw,2.25rem)] font-bold leading-none tracking-[-0.02em] text-text-primary"
        >
          {ME.name}
        </h2>
        <p className="font-body text-[15px] leading-relaxed text-text-secondary">
          {ME.role}
        </p>
        <div className="flex flex-wrap items-center gap-2 font-heading text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-surface px-3 py-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {ME.location} · {ME.timezone}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-bg-surface px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {ME.availability}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-heading text-[13px]">
          <a
            href={`mailto:${ME.email}`}
            className="focus-ring inline-flex items-center gap-1.5 text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {ME.email}
          </a>
          <a
            href={ME.socials.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
          >
            LinkedIn
          </a>
          <a
            href={ME.socials.github}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
          >
            GitHub
          </a>
          <a
            href={ME.socials.x}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent-text hover:decoration-accent"
          >
            X
          </a>
        </div>
      </div>

      <div className="h-px w-full bg-border/70" aria-hidden="true" />

      {/* summary */}
      <section aria-label="Summary" className="flex flex-col gap-2">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Summary
        </h3>
        <p className="font-body text-[14.5px] leading-relaxed text-text-secondary">
          {ME.tagline} Sweet spot: where design tokens and component APIs meet
          tRPC routes and Postgres queries — perf, a11y and DX included by
          default.
        </p>
      </section>

      {/* experience */}
      <section aria-label="Experience" className="flex flex-col gap-3">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Experience
        </h3>
        <ul className="flex flex-col gap-3">
          {EXPERIENCE.map((job) => (
            <li
              key={`${job.company}-${job.period}`}
              className="rounded-[16px] border border-border bg-bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-[15px] font-semibold tracking-tight text-text-primary">
                  {job.company}
                  <span className="ml-2 font-body text-[13.5px] font-normal text-text-secondary">
                    {job.role}
                  </span>
                </p>
                <p className="font-heading text-xs text-text-muted">{job.period}</p>
              </div>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-body text-[13.5px] leading-relaxed text-text-secondary">
                {job.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* education */}
      <section aria-label="Education" className="flex flex-col gap-3">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Education
        </h3>
        <ul className="flex flex-col gap-2">
          {EDUCATION.map((entry) => (
            <li
              key={`${entry.school}-${entry.period}`}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-[14px] border border-border bg-bg-surface px-4 py-3"
            >
              <p className="font-display text-[14.5px] font-semibold tracking-tight text-text-primary">
                {entry.school}
                <span className="ml-2 font-body text-[13px] font-normal text-text-secondary">
                  {entry.degree}
                </span>
              </p>
              <p className="font-heading text-xs text-text-muted">{entry.period}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* skills */}
      <section aria-label="Skills" className="flex flex-col gap-3">
        <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Skills
        </h3>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border bg-bg-surface px-3.5 py-2 font-body text-[13px] leading-none tracking-tight text-text-secondary"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CvModal({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevOverflowRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const lenis = (
      window as unknown as { __lenis?: { stop: () => void; start: () => void } }
    ).__lenis;
    lenis?.stop();
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflowRef.current;
      const lenis = (
        window as unknown as { __lenis?: { stop: () => void; start: () => void } }
      ).__lenis;
      lenis?.start();
    };
  }, [open, onClose]);

  const handlePrint = useCallback((): void => {
    window.print();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-md"
          />
          <div
            className="fixed inset-0 z-[1401] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
            style={{ overscrollBehavior: "contain" }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cv-modal-title"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", damping: 30, stiffness: 350, mass: 1 }}
              onClick={(e) => e.stopPropagation()}
              data-lenis-prevent
              className="pointer-events-auto flex max-h-[90dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-[20px] border border-border bg-bg-primary shadow-2xl"
            >
              {/* modal header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-7">
                <div className="flex items-center gap-2.5 text-text-primary">
                  <FileText className="h-5 w-5 text-accent-text" aria-hidden="true" />
                  <p className="font-heading text-sm font-semibold tracking-tight">
                    CV — {ME.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={ME.cvUrl}
                    download
                    className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-surface px-3 py-2 font-heading text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </a>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-surface px-3 py-2 font-heading text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close CV"
                    className="focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* scrollable paper */}
              <div
                data-lenis-prevent
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7 sm:py-8"
              >
                <CvPaper />
                <p className="mt-7 font-heading text-[11px] tracking-wide text-text-muted">
                  References and full project list available on request —{" "}
                  {ME.email}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function CvModalHost(): ReactNode {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(CV_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CV_OPEN_EVENT, onOpen);
  }, []);

  return <CvModal open={open} onClose={() => setOpen(false)} />;
}
