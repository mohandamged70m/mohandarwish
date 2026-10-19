"use client";

import { useState, type ReactNode } from "react";
import type { FilterCategory, Project, TagDirectory } from "@/data/projects";
import { ProjectsGrid } from "./ProjectsGrid";
import { ProjectsTabShell } from "./ProjectsTabShell";

/**
 * Full projects archive — same for-your-project grid as the homepage
 * section, with a Projects | Developer tab switch.
 */
export function Projects({
  initialProjects,
  initialTagDir,
}: {
  initialProjects?: Project[];
  initialTagDir?: TagDirectory;
}): ReactNode {
  // Controlled so the section can widen for the Developer tab (see below).
  const [active, setActive] = useState<FilterCategory>("Projects");

  // The contribution calendar is 53 week columns wide; inside a 7xl column it
  // lands at ~20px cells on a large monitor and reads as a thin strip. Widen
  // only while the Developer tab is showing — the projects grid is not rendered
  // then, so this never changes the grid's layout.
  const isDeveloper = active === "Developer";
  const widthClass = isDeveloper ? "lg:max-w-[1680px]" : "max-w-7xl";

  return (
    <section
      aria-label="All projects"
      className={`mx-auto w-full min-w-0 px-4 pb-12 sm:px-6 lg:px-8 ${widthClass}`}
    >
      <div className="flex w-full flex-col items-center gap-8">
        <ProjectsTabShell
          value={active}
          onChange={setActive}
          projectsNode={<ProjectsGrid initialProjects={initialProjects} initialTagDir={initialTagDir} />}
        />
      </div>
    </section>
  );
}
