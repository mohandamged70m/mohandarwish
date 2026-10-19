"use client";

import { Developer } from "@/components/sections/developer";

/**
 * Developer tab content for the Projects section.
 * Reuses `components/developer/` (GitHub stats, contribution graph,
 * streak + featured repos) in embedded mode — no full-page padding.
 *
 * The column is wider than the surrounding 7xl grid: the contribution calendar
 * is 53 week columns, and at 7xl the cells shrink to ~20px on a large monitor.
 * Only ever renders developer content, so the extra width costs the projects
 * grid nothing.
 */
export function DeveloperTab() {
  return (
    <div className="mx-auto w-full max-w-[1680px] min-w-0 px-4 sm:px-6 lg:px-8">
      <Developer embedded />
    </div>
  );
}
