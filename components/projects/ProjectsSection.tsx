"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FILTER_CATEGORIES, PROJECTS } from "@/Data/projects";
import type { FilterCategory } from "@/Data/projects";
import { ProjectFilter } from "./ProjectFilter";
import { ProjectsCarousel } from "./ProjectsCarousel";
import { ProjectsHeader } from "./ProjectsHeader";

export default function ProjectsSection() {
  const [active, setActive] = useState<FilterCategory>("Best Works");

  // Homepage shows only featured (top 6) for "Best Works", not the full archive
  const filtered = useMemo(() => {
    if (active === "Best Works") return PROJECTS.filter((p) => p.featured);
    return PROJECTS.filter((p) => p.category === active);
  }, [active]);

  const filterCounts = useMemo<Record<FilterCategory, number>>(
    () => ({
      "Best Works": PROJECTS.filter((p) => p.featured).length,
      Frontend: PROJECTS.filter((p) => p.category === "Frontend").length,
      "Full-Stack": PROJECTS.filter((p) => p.category === "Full-Stack").length,
      "Design System": PROJECTS.filter((p) => p.category === "Design System").length,
      Tooling: PROJECTS.filter((p) => p.category === "Tooling").length,
    }),
    []
  );

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="relative w-full overflow-hidden bg-bg-primary border-t border-border/50"
    >
      {/* backdrop — lime glow + grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[86%] bg-[radial-gradient(ellipse_at_50%_0%,var(--accent-ring)_0%,transparent_62%)] opacity-70" />
        <div className="absolute inset-0 opacity-[0.035] [mask-image:radial-gradient(ellipse_at_50%_12%,black_38%,transparent_78%)] bg-[linear-gradient(to_right,var(--border-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-strong)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
        {/* subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/40" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 sm:gap-10 px-0 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* filter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full justify-center px-4 sm:px-0"
        >
          <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={filterCounts} />
        </motion.div>

        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="w-full px-4 sm:px-0"
        >
          <ProjectsHeader />
        </motion.div>

        <p className="sr-only" aria-live="polite">
          Showing {filtered.length} projects for {active}
        </p>

        {/* carousel or empty */}
        {filtered.length === 0 ? (
          <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
            <p className="font-heading text-sm font-medium text-text-primary">No projects in {active} — try Best Works</p>
            <p className="font-body text-sm text-text-muted mt-1">Switch filter to see featured engineering mocks.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
            className="w-full"
          >
            <ProjectsCarousel projects={filtered} active={active} />
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="flex w-full flex-col items-center gap-3 pt-2"
        >
          <Link href="/projects" aria-label="See all projects">
            <Button
              variant="secondary"
              size="md"
              className="group rounded-pill border-border px-8 hover:border-accent hover:text-accent hover:shadow-[0_0_20px_var(--accent-ring)] transition-all"
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
