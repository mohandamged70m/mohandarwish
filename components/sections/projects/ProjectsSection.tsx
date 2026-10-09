"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FILTER_CATEGORIES } from "@/data/projects";
import type { FilterCategory, Project } from "@/data/projects";
import { ProjectsTabs } from "./ProjectsTabs";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectsHeader } from "./ProjectsHeader";

// Developer tab (graph + lottie) is hidden until the user clicks the
// Developer filter — split it out so it never lands in the initial
// Projects bundle. Loaded on demand via next/dynamic.
const DeveloperTab = dynamic(
  () => import("./DeveloperTab").then((m) => m.DeveloperTab),
  { ssr: false, loading: () => null }
);

const CONTENT_FADE_DURATION = 0.15;

const SECTION_TABS = FILTER_CATEGORIES.map((c) => ({ id: c, label: c }));

/**
 * Homepage projects section — for-your-project grid with a
 * Projects | Developer tab switch. Live Convex data with server-rendered
 * `initialProjects` for instant first paint.
 */
export default function ProjectsSection({ initialProjects }: { initialProjects?: Project[] }) {
  const [active, setActive] = useState<FilterCategory>("Projects");
  const reduce = useReducedMotion();
  const noMotion = reduce ? { initial: false } : {};
  const isDeveloper = active === "Developer";

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="w-full max-w-full min-w-0 bg-bg-primary scroll-mt-20"
    >
      <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: reduce ? 0.01 : 0.45, ease: [0.22, 1, 0.36, 1], delay: 0 }}
            {...noMotion}
            className="w-full min-w-0 overflow-hidden"
          >
            <ProjectsHeader active={active} />
          </motion.div>

          <div className="flex w-full min-w-0 justify-center">
            <ProjectsTabs
              tabs={SECTION_TABS}
              value={active}
              onChange={(id) => setActive(id as FilterCategory)}
              ariaLabel="Projects or developer profile"
            />
          </div>

          <p className="sr-only" aria-live="polite">
            Showing {isDeveloper ? "developer profile" : "projects"} for {active}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduce ? 0.01 : CONTENT_FADE_DURATION,
                ease: "easeOut",
              }}
              className="w-full max-w-full min-w-0 overflow-hidden"
            >
              {isDeveloper ? (
                <div className="w-full max-w-full min-w-0 overflow-hidden">
                  <DeveloperTab />
                </div>
              ) : (
                <ProjectsGrid initialProjects={initialProjects} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
