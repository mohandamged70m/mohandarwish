"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FILTER_CATEGORIES } from "@/Data/projects";
import type { FilterCategory } from "@/Data/projects";
import { ProjectFilter } from "./ProjectFilter";
import { ProjectCard } from "./ProjectCard";
import { DeveloperTab } from "./DeveloperTab";
import { ProjectsHeader } from "./ProjectsHeader";
import { useProjects } from "@/hooks/useProjects";
import { useDeveloperRepos } from "@/hooks/useDeveloperRepos";

export default function ProjectsSection() {
  const [active, setActive] = useState<FilterCategory>("Projects");
  const { projects, loading } = useProjects();
  const { repos: devRepos } = useDeveloperRepos();

  // Homepage: Projects = featured (top 6 by Listing), Developer = GitHub featured repos
  const filtered = useMemo(() => {
    if (active === "Projects") return projects.filter((p) => p.featured);
    return [];
  }, [active, projects]);

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

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="relative w-full max-w-full min-w-0 overflow-hidden isolate [contain:layout_paint] bg-bg-primary scroll-mt-20"
    >
      {/* backdrop — lime glow + grid — true frameless: no border, max-width contained */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 mx-auto max-w-[1600px] bg-[radial-gradient(ellipse_at_50%_0%,var(--accent-ring)_0%,transparent_62%)] opacity-60" />
        <div className="absolute inset-0 opacity-[0.032] [mask-image:radial-gradient(ellipse_at_50%_12%,black_38%,transparent_78%)] bg-[linear-gradient(to_right,var(--border-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-strong)_1px,transparent_1px)] bg-[size:28px_28px]" />
        {/* no top hairline — frameless: gap, not border, creates rhythm */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/30" />
      </div>

      <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden py-12 sm:py-16 lg:py-20">
        {/* header block — constrained */}
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden px-4 sm:px-6 lg:px-8">
          {/* header — swaps copy with the tab so Projects / Developer each own their headline */}
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            className="w-full min-w-0 overflow-hidden"
          >
            <ProjectsHeader
              active={active}
              projectsCount={projects.filter((p) => p.featured).length}
              devCount={devRepos.length}
            />
          </motion.div>

          <p className="sr-only" aria-live="polite">
            Showing {isDeveloper ? "developer profile" : `${filtered.length} projects`} for {active}
          </p>

          {/* empty state — stays inside gutter (projects only; developer handles its own) */}
          {showEmpty && (
            <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
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
            <div className="w-full rounded-[16px] border border-border bg-bg-surface px-6 py-10 text-center">
              <p className="font-heading text-sm font-medium text-text-primary">Loading projects…</p>
            </div>
          )}
        </div>

        {/* showcase grid — Swiss minimal, zero horizontal scroll: 1 / 2 / 3
            columns with a lead card spanning two for editorial rhythm */}
        {!isDeveloper && filtered.length > 0 && (
          <div className="mx-auto w-full max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8">
            <div
              role="list"
              aria-label="Featured projects"
              className="grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((project, i) => (
                <motion.div
                  key={project.id}
                  role="listitem"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                    delay: (i % 3) * 0.08,
                  }}
                  className={i === 0 && filtered.length >= 4 ? "sm:col-span-2" : undefined}
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
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
            className="w-full max-w-full min-w-0 overflow-hidden"
          >
            <DeveloperTab />
          </motion.div>
        )}

        {/* CTA + filter — constrained, centered bottom navbar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 px-4 sm:px-6 lg:px-8 pt-2"
        >
          {/* filter navbar — center bottom */}
          <div className="flex w-full min-w-0 justify-center">
            <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={filterCounts} />
          </div>
          <Link href="/projects" aria-label="See all projects">
            <Button
              variant="secondary"
              size="md"
              className="group rounded-pill border-border px-8 min-h-11 hover:border-accent hover:text-accent hover:shadow-[0_0_20px_var(--accent-ring)] transition-all"
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
