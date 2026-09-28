import type { FilterCategory } from "@/data/projects";

type Props = {
  active?: FilterCategory;
};

export function ProjectsHeader({ active = "Projects" }: Props) {
  const isDeveloper = active === "Developer";

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4 text-center sm:gap-5">
      {isDeveloper ? (
        <>
          <h2 data-pager-focus tabIndex={-1} className="max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary">
            Code in the open<span aria-hidden className="text-accent-text">.</span>
          </h2>
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
            Commits, streaks and handpicked repos — synced from GitHub and updated daily.
          </p>
        </>
      ) : (
        <>
          <h2 data-pager-focus tabIndex={-1} className="max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance text-text-primary">
            Selected work<span aria-hidden className="text-accent-text">.</span>
          </h2>
          <p className="max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty text-text-secondary sm:text-base">
            Production apps, design systems and tooling. Each one has a live demo, source code and build notes.
          </p>
        </>
      )}
    </div>
  );
}
