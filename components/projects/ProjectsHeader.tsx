import type { FilterCategory } from "@/Data/projects";

type Props = {
  active?: FilterCategory;
  projectsCount?: number;
  devCount?: number;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-sm border border-border bg-bg-surface px-3 py-1.5 font-heading text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      {children}
    </span>
  );
}

export function ProjectsHeader({ active = "Projects", projectsCount, devCount }: Props) {
  const isDeveloper = active === "Developer";

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4 text-center sm:gap-5">
      {isDeveloper ? (
        <>
          <Eyebrow>
            <span className="truncate">
              <span className="text-text-secondary">~/developer</span>
              <span aria-hidden className="mx-1.5 text-border-strong">
                ·
              </span>
              <span>live from GitHub</span>
              {typeof devCount === "number" && devCount > 0 && (
                <span className="ml-2 rounded-sm bg-accent/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-accent-text">
                  {devCount} repos
                </span>
              )}
            </span>
          </Eyebrow>
          <h2 data-pager-focus tabIndex={-1} className="max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary">
            Code in the open<span aria-hidden className="text-accent-text">.</span>
          </h2>
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
            Commits, streaks and handpicked repos — synced from GitHub and updated daily.
          </p>
        </>
      ) : (
        <>
          <Eyebrow>
            <span className="truncate">
              <span className="text-text-secondary">~/projects</span>
              {typeof projectsCount === "number" && projectsCount > 0 && (
                <>
                  <span aria-hidden className="mx-1.5 text-border-strong">
                    ·
                  </span>
                  <span>{projectsCount} selected</span>
                </>
              )}
            </span>
          </Eyebrow>
          <h2 data-pager-focus tabIndex={-1} className="max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary">
            Selected work<span aria-hidden className="text-accent-text">.</span>
          </h2>
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
            Production apps, design systems and tooling — each with a live demo, source code and
            build notes.
          </p>
        </>
      )}
    </div>
  );
}
