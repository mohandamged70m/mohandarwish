"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FILTER_CATEGORIES } from "@/data/projects";
import type { FilterCategory, Project } from "@/data/projects";
import { ProjectFilter } from "./ProjectFilter";
import { ProjectCard } from "./ProjectCard";
import { ProjectsHeader } from "./ProjectsHeader";
import { useProjects } from "@/hooks/useProjects";
import { useDeveloperRepos } from "@/hooks/useDeveloperRepos";
import { useTailor } from "@/lib/analytics/tailor";

// Developer tab (animejs + GitHub graph) is hidden until the user clicks
// the Developer filter — split it out so animejs never lands in the
// initial Projects bundle. Same UI, just loaded on demand per
// docs/01-app/02-guides/lazy-loading.md (next/dynamic, Client Component).
const DeveloperTab = dynamic(
  () => import("./DeveloperTab").then((m) => m.DeveloperTab),
  { ssr: false, loading: () => null }
);

// Warms the Developer chunk on hover/focus intent so the first tab click
// never pays dynamic-import (animejs + graph) + mount inside one frame.
function prefetchDeveloperTab() {
  void import("./DeveloperTab");
}

export default function ProjectsSection({ initialProjects }: { initialProjects?: Project[] }) {
  const [active, setActive] = useState<FilterCategory>("Projects");
  const { projects, loading } = useProjects(initialProjects);
  const { repos: devRepos } = useDeveloperRepos();
  // A share link can ask for specific projects to float to the top of the grid —
  // "here are the three that matter for you" instead of the usual ranking.
  const tailor = useTailor();

  // Homepage: Projects = featured (top 6 by Listing), Developer = GitHub featured repos
  const filtered = useMemo(() => {
    const featured = active === "Projects" ? projects.filter((p) => p.featured) : [];
    const pinned = tailor?.Pinned ?? [];
    if (!pinned.length) return featured;
    // Pinned order is the link's order; unpinned keep their normal ranking behind it.
    return [
      ...pinned
        .map((id) => featured.find((p) => p.id === id))
        .filter((p): p is Project => !!p),
      ...featured.filter((p) => !pinned.includes(p.id)),
    ];
  }, [active, projects, tailor]);

  const filterCounts = useMemo<Record<FilterCategory, number>>(
    () => ({
      Projects: projects.filter((p) => p.featured).length,
      Developer: devRepos.length,
    }),
    [projects, devRepos]
  );

  const isDeveloper = active === "Developer";
  const showEmpty = !isDeveloper && !loading && filtered.length === 0;
  const isLoading = isDeveloper ? false : loading;
  const reduce = useReducedMotion();
  const noMotion = reduce ? { initial: false } : {};

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="w-full max-w-full min-w-0 bg-bg-primary scroll-mt-20"
    >
      <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden py-12 sm:py-16 lg:py-20">
        {/* header block — constrained */}
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden px-4 sm:px-6 lg:px-8">
          {/* header — swaps copy with the tab so Projects / Developer each own their headline */}
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: reduce ? 0.01 : 0.6, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.08 }}
            {...noMotion}
            className="w-full min-w-0 overflow-hidden"
          >
            <ProjectsHeader active={active} />
          </motion.div>

          {/* filter — top, under header for discoverability (was bottom) */}
          <div className="flex w-full min-w-0 justify-center">
            <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={filterCounts} onPreviewCategory={(c) => { if (c === "Developer") prefetchDeveloperTab(); }} />
          </div>

          <p className="sr-only" aria-live="polite">
            Showing {isDeveloper ? "developer profile" : `${filtered.length} projects`} for {active}
          </p>

          {/* empty state — stays inside gutter (projects only; developer handles its own) */}
          {showEmpty && (
            <div className="w-full rounded-md border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
              <p className="font-heading text-sm font-medium text-text-primary">
                {projects.length === 0
                  ? "No projects yet — add one from the dashboard"
                  : `No projects in ${active} — try Projects`}
              </p>
              <p className="font-body text-sm text-text-muted mt-1">
                {projects.length === 0
                  ? "Dashboard → Projects → Add Project, it appears here live."
                  : "Switch filter to see featured projects."}
              </p>
            </div>
          )}
          {isLoading && (
            <div className="w-full rounded-md border border-border bg-bg-surface px-6 py-10 text-center">
              <p className="font-heading text-sm font-medium text-text-primary">Loading projects…</p>
            </div>
          )}
        </div>

        {/* showcase grid — uniform 1 / 2 / 3 rhythm, hierarchy from index+metric */}
        {!isDeveloper && filtered.length > 0 && (
          <div className="mx-auto w-full max-w-7xl min-w-0 px-4 pt-2 sm:px-6 lg:px-8">
            <div
              role="list"
              aria-label="Featured projects"
              className="grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((project, i) => (
                <motion.div
                  key={project.id}
                  role="listitem"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: reduce ? 0.01 : 0.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: reduce ? 0 : (i % 3) * 0.08,
                  }}
                  {...noMotion}
                >
                  <ProjectCard
                    project={project}
                    featured={active === "Projects" && project.featured}
                    fluid
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* developer — full profile from components/developer/ (stats, graph, streak, repos) */}
        {isDeveloper && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: reduce ? 0.01 : 0.7, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.14 }}
            {...noMotion}
            className="w-full max-w-full min-w-0 overflow-hidden"
          >
            <DeveloperTab />
          </motion.div>
        )}

        {/* CTA — filter lives on top now, bottom keeps See-all only */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: reduce ? 0.01 : 0.5, delay: reduce ? 0 : 0.22 }}
          {...noMotion}
          className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 sm:px-6 lg:px-8 pt-2"
        >
          <Link href="/projects" aria-label="See all projects">
            <Button
              variant="secondary"
              size="md"
              className="group rounded-sm border-border px-8 min-h-11 hover:border-accent hover:text-accent-text hover:shadow-[0_0_20px_var(--accent-ring)] transition-all"
            >
              See all
              <span
                aria-hidden
                className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Button>
          </Link>
          <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {active}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
