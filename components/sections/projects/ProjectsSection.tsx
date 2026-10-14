"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { FilterCategory, Project, TagDirectory } from "@/data/projects";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectsTabShell } from "./ProjectsTabShell";

/**
 * Homepage projects section — for-your-project grid with a
 * Projects | Developer tab switch. Live Convex data with server-rendered
 * `initialProjects` for instant first paint.
 */
export default function ProjectsSection({ initialProjects, initialTagDir }: { initialProjects?: Project[]; initialTagDir?: TagDirectory }) {
  const [active, setActive] = useState<FilterCategory>("Projects");
  const reduce = useReducedMotion();
  const noMotion = reduce ? { initial: false } : {};

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

          <ProjectsTabShell
            value={active}
            onChange={setActive}
            projectsNode={<ProjectsGrid initialProjects={initialProjects} initialTagDir={initialTagDir} />}
          />
        </div>
      </div>
    </section>
  );
}
