"use client";

import type { ReactNode } from "react";
import type { Project, TagDirectory } from "@/data/projects";
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
  return (
    <section
      aria-label="All projects"
      className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
    >
      <div className="flex w-full flex-col items-center gap-8">
        <ProjectsTabShell
          projectsNode={<ProjectsGrid initialProjects={initialProjects} initialTagDir={initialTagDir} />}
        />
      </div>
    </section>
  );
}
