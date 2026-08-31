"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { ViewTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { FILTER_CATEGORIES, PROJECTS } from "@/Data/projects";
import type { FilterCategory } from "@/Data/projects";
import { ProjectFilter } from "./ProjectFilter";
import type { ReactNode } from "react";

export function Projects(): ReactNode {
  const [active, setActive] = useState<FilterCategory>("Best Works");

  const filtered = useMemo(() => {
    if (active === "Best Works") return PROJECTS;
    return PROJECTS.filter((p) => p.category === active);
  }, [active]);

  const counts = useMemo<Record<FilterCategory, number>>(
    () => ({
      "Best Works": PROJECTS.length,
      Frontend: PROJECTS.filter((p) => p.category === "Frontend").length,
      "Full-Stack": PROJECTS.filter((p) => p.category === "Full-Stack").length,
      "Design System": PROJECTS.filter((p) => p.category === "Design System").length,
      Tooling: PROJECTS.filter((p) => p.category === "Tooling").length,
    }),
    []
  );

  return (
    <section aria-label="All projects" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
      <div className="flex w-full flex-col items-center gap-8">
        <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={counts} />
        <p className="sr-only" aria-live="polite">
          Showing {filtered.length} projects for {active}
        </p>

        {filtered.length === 0 ? (
          <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
            <p className="font-heading text-sm font-medium text-text-primary">No projects in {active} — try Best Works</p>
            <p className="font-body text-sm text-text-muted mt-1">Switch filter to see featured projects.</p>
          </div>
        ) : (
          <motion.div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((project, idx) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: Math.min(idx * 0.04, 0.2) }}
                  className="min-w-0"
                >
                <Link
                  href={project.href}
                  aria-label={`${project.title} — ${project.category}`}
                  className="group relative flex w-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-border bg-bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.25)] transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-1 hover:border-border-strong hover:bg-bg-surface-hover hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative mx-2 mt-2 overflow-hidden rounded-[12px] border border-border/60 bg-bg-primary">
                    <div className="flex items-center gap-1.5 border-b border-border/40 bg-bg-surface/40 px-3 py-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] border border-black/10" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] border border-black/10" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] border border-black/10" />
                      <span className="ml-3 hidden sm:inline-flex h-5 flex-1 max-w-[180px] items-center gap-2 truncate rounded-full border border-border bg-bg-primary px-2.5 font-body text-[11px] text-text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                        {project.title}
                      </span>
                    </div>
                    <ViewTransition name={`project-${project.id}`} share="morph">
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-primary">
                        <Image
                          src={project.image}
                          alt={project.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover will-change-transform transition-transform duration-700 ease-[0.22,1,0.36,1] group-hover:scale-[1.06]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent opacity-70" />
                        <div className="absolute left-3 top-3 flex items-center gap-2">
                          <Badge variant="default" className="bg-bg-surface/90 backdrop-blur border-border text-[11px] px-2.5 py-1 shadow-sm">
                            {project.category}
                          </Badge>
                          {project.year && (
                            <Badge variant="soft" className="text-[11px] px-2.5 py-1 shadow-sm">
                              {project.year}
                            </Badge>
                          )}
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-primary/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          <span className="inline-flex items-center gap-1.5 rounded-pill bg-bg-surface border border-border px-3 py-1.5 font-heading text-xs text-text-primary shadow-md">
                            View case study <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
                          </span>
                        </div>
                      </div>
                    </ViewTransition>
                  </div>
                  <div className="flex flex-col gap-2 px-3 pb-3 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-heading text-[15px] font-semibold leading-tight text-text-primary transition-colors group-hover:text-accent line-clamp-1">
                        {project.title}
                      </h3>
                      <span className="hidden sm:inline-flex shrink-0 items-center gap-1 font-heading text-[11px] uppercase tracking-wide text-text-muted transition-colors group-hover:text-accent">
                        View <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                    {project.description && (
                      <p className="font-body text-[13px] leading-relaxed text-text-secondary line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {project.stack?.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-pill border border-border bg-bg-primary px-2 py-1 font-body text-[11px] leading-none text-text-secondary"
                          >
                            {s}
                          </span>
                        ))}
                        {project.year && (
                          <span className="inline-flex items-center rounded-pill border border-border bg-accent-soft px-2 py-1 font-heading text-[11px] leading-none text-accent-soft-text">{project.year}</span>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5">
                        {project.githubUrl && project.githubUrl !== "#" && (
                          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary font-heading text-[10px] leading-none text-text-muted transition-colors group-hover:border-accent/30 group-hover:text-accent">GH</span>
                        )}
                        {project.liveUrl && project.liveUrl !== "#" && (
                          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary text-text-muted transition-colors group-hover:border-accent/30 group-hover:text-accent"><ExternalLink className="h-3.5 w-3.5" /></span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
          {filtered.length} projects · {active}
        </span>
      </div>
    </section>
  );
}
