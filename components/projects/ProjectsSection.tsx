"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FILTER_CATEGORIES, PROJECTS } from "@/Data/projects";
import type { FilterCategory } from "@/Data/projects";
import { ProjectFilter } from "./ProjectFilter";
import { ProjectsCarousel } from "./ProjectsCarousel";
import { ProjectsHeader } from "./ProjectsHeader";

export default function ProjectsSection() {
  const sectionRef = useRef<HTMLElement>(null);
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
      ref={sectionRef}
      id="projects"
      aria-label="Projects"
      className="relative w-full max-w-full min-w-0 overflow-hidden isolate [contain:layout_paint] bg-bg-primary"
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
          {/* filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full min-w-0 justify-center"
          >
            <ProjectFilter categories={FILTER_CATEGORIES} active={active} onChange={setActive} counts={filterCounts} />
          </motion.div>

          {/* header */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            className="w-full min-w-0 overflow-hidden"
          >
            <ProjectsHeader />
          </motion.div>

          <p className="sr-only" aria-live="polite">
            Showing {filtered.length} projects for {active}
          </p>

          {/* empty state — stays inside gutter */}
          {filtered.length === 0 && (
            <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
              <p className="font-heading text-sm font-medium text-text-primary">No projects in {active} — try Best Works</p>
              <p className="font-body text-sm text-text-muted mt-1">Switch filter to see featured engineering mocks.</p>
            </div>
          )}
        </div>

        {/* carousel — FULL BLEED frameless: viewport owns gutters, not section container */}
        {filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
            className="w-full max-w-full min-w-0 overflow-hidden"
          >
            <ProjectsCarousel projects={filtered} active={active} sectionRef={sectionRef} />
          </motion.div>
        )}

        {/* CTA — constrained */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 sm:px-6 lg:px-8 pt-2"
        >
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
