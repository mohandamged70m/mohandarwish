"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FILTER_CATEGORIES, type FilterCategory } from "@/data/projects";
import { useState } from "react";
import { ProjectsTabs } from "./ProjectsTabs";

// Developer tab (graph + lottie) is hidden until the user clicks the
// Developer filter — split it out so it never lands in the initial
// bundle. Loaded on demand via next/dynamic.
const DeveloperTab = dynamic(
  () => import("./DeveloperTab").then((m) => m.DeveloperTab),
  { ssr: false, loading: () => null }
);

const CONTENT_FADE_DURATION = 0.15;

const TABS = FILTER_CATEGORIES.map((c) => ({ id: c, label: c }));

/**
 * Shared Projects | Developer tab switch + fade. Used by both the homepage
 * section and the /projects archive so the two can't drift apart.
 * `projectsNode` is the grid (callers pass server-hydrated props).
 * Controlled when `value`/`onChange` are given (homepage header follows the
 * tab); uncontrolled otherwise.
 */
export function ProjectsTabShell({
  projectsNode,
  value,
  onChange,
}: {
  projectsNode: ReactNode;
  value?: FilterCategory;
  onChange?: (t: FilterCategory) => void;
}) {
  const [internal, setInternal] = useState<FilterCategory>("Projects");
  const active = value ?? internal;
  const setActive = onChange ?? setInternal;
  const reduce = useReducedMotion();
  const isDeveloper = active === "Developer";

  return (
    <>
      <div className="flex w-full min-w-0 justify-center">
        <ProjectsTabs
          tabs={TABS}
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
            projectsNode
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
