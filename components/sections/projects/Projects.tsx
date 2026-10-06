"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FILTER_CATEGORIES } from "@/data/projects";
import type { FilterCategory } from "@/data/projects";
import { ProjectsTabs } from "./ProjectsTabs";
import { ProjectsGrid } from "./ProjectsGrid";

// Same split as the homepage section: Developer tab (graph + lottie)
// never lands in the archive bundle until requested.
const DeveloperTab = dynamic(
  () => import("./DeveloperTab").then((m) => m.DeveloperTab),
  { ssr: false, loading: () => null }
);

const CONTENT_FADE_DURATION = 0.15;

const ARCHIVE_TABS = FILTER_CATEGORIES.map((c) => ({ id: c, label: c }));

/**
 * Full projects archive — same for-your-project grid as the homepage
 * section, with a Projects | Developer tab switch.
 */
export function Projects(): ReactNode {
  const [active, setActive] = useState<FilterCategory>("Projects");
  const reduce = useReducedMotion();
  const isDeveloper = active === "Developer";

  return (
    <section
      aria-label="All projects"
      className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
    >
      <div className="flex w-full flex-col items-center gap-8">
        <div className="flex w-full min-w-0 justify-center">
          <ProjectsTabs
            tabs={ARCHIVE_TABS}
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
            className="w-full"
          >
            {isDeveloper ? <DeveloperTab /> : <ProjectsGrid />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
