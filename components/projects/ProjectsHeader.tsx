export function ProjectsHeader() {
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 w-full max-w-full min-w-0 overflow-hidden">
      <h2
        className="font-heading font-black uppercase text-center leading-[0.9] tracking-[-0.055em] select-none [text-wrap:balance] break-words [overflow-wrap:anywhere] w-full max-w-full min-w-0 overflow-hidden
                   text-[clamp(1.9rem,8vw,2rem)] sm:text-[3.2rem] lg:text-[4.6rem] xl:text-[5.4rem]"
        aria-label="Personal Projects"
      >
        <span
          className="relative inline max-w-full break-words [overflow-wrap:anywhere]"
          style={{ WebkitTextStroke: "1px var(--border-strong)" }}
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-text-primary/[0.06] via-text-primary/[0.03] to-transparent bg-clip-text text-transparent opacity-60 dark:opacity-100"
          >
            PERSONAL PROJECTS
          </span>
          <span className="relative inline bg-gradient-to-b from-text-primary via-text-primary to-text-primary/75 bg-clip-text break-words [overflow-wrap:anywhere]">
            PERSONAL PROJECTS
          </span>
        </span>
      </h2>
      <p className="font-body text-[13px] sm:text-sm leading-relaxed text-text-secondary text-center max-w-[52ch] text-pretty px-2 w-full">
        A frameless, edge-to-edge selection — featured work peeks to hint there&apos;s more to explore.
      </p>
    </div>
  );
}
