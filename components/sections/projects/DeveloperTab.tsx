"use client";

import { Developer } from "@/components/developer";

/**
 * Developer tab content for the Projects section.
 * Reuses `components/developer/` (GitHub stats, contribution graph,
 * streak + featured repos) in embedded mode — no full-page padding.
 */
export function DeveloperTab() {
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 px-4 sm:px-6 lg:px-8">
      <Developer embedded />
    </div>
  );
}
