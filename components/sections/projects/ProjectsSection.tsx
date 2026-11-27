"use client";

import { useState } from "react";
import type { FilterCategory, Project, TagDirectory } from "@/data/projects";
import { SelectedWorkGrid } from "./SelectedWorkGrid";
import { ProjectsHeader } from "./ProjectsHeader";
import { ProjectsTabShell } from "./ProjectsTabShell";

/**
 * Homepage projects section — for-your-project grid with a
 * Projects | Developer tab switch. Live Convex data with server-rendered
 * `initialProjects` for instant first paint.
 */
export default function ProjectsSection({ initialProjects, initialTagDir }: { initialProjects?: Project[]; initialTagDir?: TagDirectory }) {
  const [active, setActive] = useState<FilterCategory>("Projects");

  // The contribution calendar is 53 week columns wide; inside a 7xl column it
  // lands at ~20px cells on a large monitor and reads as a thin strip. Widen
  // only while the Developer tab is showing — the projects grid is not rendered
  // then, so this never changes the grid's layout.
  const isDeveloper = active === "Developer";
  const widthClass = isDeveloper ? "lg:max-w-[1680px]" : "max-w-[1120px]";

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="w-full max-w-full min-w-0 bg-bg-primary scroll-mt-20"
    >
      <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className={`mx-auto flex w-full min-w-0 flex-col items-center gap-8 sm:gap-10 overflow-hidden px-4 sm:px-6 lg:px-8 ${widthClass}`}>
          {/* Reveal handles this now — no competing framer entrance. */}
          <div className="item w-full min-w-0 overflow-hidden">
            <ProjectsHeader active={active} />
          </div>

          <ProjectsTabShell
            value={active}
            onChange={setActive}
            projectsNode={<SelectedWorkGrid initialProjects={initialProjects} initialTagDir={initialTagDir} />}
          />
        </div>
      </div>
    </section>
  );
}
