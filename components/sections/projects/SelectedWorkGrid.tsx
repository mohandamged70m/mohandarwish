"use client";

import Image from "next/image";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Project, TagDirectory } from "@/data/projects";
import { useProjects } from "@/hooks/useProjects";
import { isVideoFile } from "@/lib/project-utils";

type Props = {
  initialProjects?: Project[];
  initialTagDir?: TagDirectory;
};

function techNames(project: Project): string[] {
  const names = new Set<string>();
  project.tagsDetailed?.forEach((tag) => names.add(tag.name));
  project.stack?.forEach((tech) => names.add(tech));
  return [...names];
}

function stills(project: Project): string[] {
  const seen = new Set<string>();
  for (const src of [project.image, ...(project.images ?? [])]) {
    if (src && !isVideoFile(src) && !seen.has(src)) seen.add(src);
  }
  return [...seen];
}

/** A screenshot, or a token-only wireframe when a project has no image yet. */
function Shot({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex flex-col justify-center gap-2.5 bg-[var(--surface-raised)] px-7">
        <span className="font-heading text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {title}
        </span>
        <span className="h-1 w-1/2 rounded-full bg-[var(--line)]" />
        <span className="h-1 w-4/5 rounded-full bg-[var(--line)]" />
        <span className="h-1 w-2/3 rounded-full bg-[var(--line)]" />
        <span className="mt-2 h-1 w-16 rounded-full bg-[var(--accent)]" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      sizes="(max-width: 768px) 100vw, 50vw"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function ProjectCard({
  project,
  onOpen,
  reduce,
}: {
  project: Project;
  onOpen: (project: Project) => void;
  reduce: boolean;
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const images = useMemo(() => stills(project), [project]);
  const count = images.length;

  // Only advances while hovered or keyboard-focused, never for reduced motion.
  useEffect(() => {
    if (!active || count < 2 || reduce) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 1600);
    return () => window.clearInterval(id);
  }, [active, count, reduce]);

  const names = techNames(project);
  const visible = names.slice(0, 3);
  const extra = names.length - visible.length;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 30 }
      }
      onClick={() => onOpen(project)}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setActive(false);
        }
      }}
      aria-label={`Open ${project.title} details`}
      className="group flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] text-left transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div
        aria-hidden="true"
        className="relative aspect-video w-full overflow-hidden bg-[var(--surface-raised)]"
      >
        {(count ? images : [undefined]).map((src, i) => (
          <motion.div
            key={src ?? `${project.id}-empty`}
            className="absolute inset-0"
            animate={{ opacity: i === index ? 1 : 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.35, ease: "easeInOut" }
            }
          >
            <Shot src={src} title={project.title} />
          </motion.div>
        ))}

        {names.length > 0 && (
          <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
            {visible.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-heading text-[10px] uppercase tracking-wide text-[var(--text)]"
              >
                {tech}
              </span>
            ))}
            {extra > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 font-heading text-[10px] uppercase tracking-wide text-[var(--accent-ink)]">
                +{extra} more
              </span>
            )}
          </div>
        )}

        {count > 1 && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
            {images.map((src, i) => (
              <span
                key={src}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
                  i === index
                    ? "w-4 bg-[var(--accent)]"
                    : "w-1.5 bg-[var(--muted)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="break-words font-heading text-xl font-semibold text-[var(--text)]">
          {project.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
          {project.description || "Details and build notes for this project."}
        </p>
      </div>
    </motion.button>
  );
}

function ProjectDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const reduce = !!useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const lenis = (
      window as unknown as {
        __lenis?: { stop?: () => void; start?: () => void };
      }
    ).__lenis;

    document.body.style.overflow = "hidden";
    lenis?.stop?.();
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lenis?.start?.();
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const images = stills(project);
  const names = techNames(project);
  const links = [
    project.liveUrl ? { label: "Visit live site", href: project.liveUrl, primary: true } : null,
    project.githubUrl ? { label: "View source code", href: project.githubUrl, primary: false } : null,
  ].filter((link): link is { label: string; href: string; primary: boolean } => link !== null);

  return createPortal(
    <motion.div
      className="projects-scope fixed inset-0 z-[1200] flex items-center justify-center bg-[var(--scrim)] p-3 backdrop-blur-md sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
      onClick={onBackdropClick}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${project.title} project details`}
        data-lenis-prevent
        onClick={(event) => event.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 30, mass: 0.9 }
        }
        className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[0_32px_80px_-32px_var(--shadow-color)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Project details
            </p>
            <h3 className="mt-1 break-words font-heading text-xl font-semibold text-[var(--text)]">
              {project.title}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close project details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] text-xl text-[var(--text)] transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {(images.length ? images : [undefined]).map((src, i) => (
              <div
                key={src ?? `${project.id}-modal-${i}`}
                className="relative aspect-video overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)]"
              >
                <Shot src={src} title={project.title} />
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm leading-7 text-[var(--text)]">
            {project.description || "More details coming soon."}
          </p>

          {names.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {names.map((name) => (
                <span
                  key={name}
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 font-heading text-[11px] uppercase tracking-wide text-[var(--text)]"
                >
                  {name}
                </span>
              ))}
            </div>
          )}

          {links.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--line)] pt-5">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none ${
                    link.primary
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90"
                      : "border border-[var(--line)] text-[var(--text)] hover:border-[var(--accent)]"
                  }`}
                >
                  {link.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/**
 * Homepage-only Projects grid, styled from the supplied mock but driven by
 * the same Convex/dashboard data as before. The Developer tab is untouched.
 */
export function SelectedWorkGrid({ initialProjects, initialTagDir }: Props) {
  const { projects, loading, error, tagDir } = useProjects(initialProjects);
  const reduce = !!useReducedMotion();
  const filterId = useId();
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);

  const technologies = useMemo(() => {
    const names = new Set<string>();
    projects.forEach((project) => techNames(project).forEach((name) => names.add(name)));
    const directory = tagDir ?? initialTagDir;
    if (directory) {
      Object.values(directory).forEach((entry) => {
        const name = entry?.Name?.trim();
        if (name) names.add(name);
      });
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [projects, tagDir, initialTagDir]);

  // A stale filter from a live data update simply stops applying.
  const activeFilter = filter && technologies.includes(filter) ? filter : null;
  const shown = activeFilter
    ? projects.filter((project) => techNames(project).includes(activeFilter))
    : projects;

  const open = useCallback((project: Project) => setSelected(project), []);
  const close = useCallback(() => setSelected(null), []);

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-2.5">
        <span
          id={filterId}
          className="mr-1 font-heading text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]"
        >
          Filter view:
        </span>
        <div role="group" aria-labelledby={filterId} className="flex flex-wrap gap-2">
          {technologies.map((tech) => {
            const isActive = activeFilter === tech;
            return (
              <button
                key={tech}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(isActive ? null : tech)}
                className={`cursor-pointer rounded-[var(--radius-md)] border px-4 py-2 font-body text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] motion-reduce:transition-none ${
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]"
                    : "border-[var(--line)] bg-[var(--card-bg)] text-[var(--text)] hover:border-[var(--accent)]"
                }`}
              >
                {tech}
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {shown.length} {shown.length === 1 ? "project" : "projects"}
      </p>

      {loading ? (
        <div className="mt-8 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center font-heading text-sm text-[var(--muted)]">
          Loading projects…
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-8 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
          <p className="font-heading text-sm text-[var(--text)]">
            {error ? "Couldn't load projects" : "Nothing here yet."}
          </p>
          <p className="mt-1 font-body text-sm text-[var(--muted)]">
            {error ?? (projects.length === 0 ? "Add one from the dashboard." : "Try a different filter.")}
          </p>
        </div>
      ) : (
        <LayoutGroup id="selected-work-grid">
          <motion.div
            layout
            className="mt-8 grid w-full grid-cols-1 gap-6 md:grid-cols-2"
          >
            <AnimatePresence initial={false}>
              {shown.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={open}
                  reduce={reduce}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      )}

      <p className="mt-12 text-center font-heading text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {shown.length} {shown.length === 1 ? "project" : "projects"}
      </p>

      <AnimatePresence>
        {selected && (
          <ProjectDialog key={selected.id} project={selected} onClose={close} />
        )}
      </AnimatePresence>
    </div>
  );
}
