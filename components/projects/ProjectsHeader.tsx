export function ProjectsHeader() {
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      <h2
        className="font-heading font-black uppercase text-center leading-[0.88] tracking-[-0.045em] select-none
                   text-[2.2rem] sm:text-[3.4rem] lg:text-[4.8rem] xl:text-[5.6rem]"
        aria-label="Personal Projects"
      >
        <span
          className="relative inline-block text-transparent"
          style={{ WebkitTextStroke: "1px var(--border-strong)" }}
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-text-primary/[0.07] via-text-primary/[0.03] to-transparent bg-clip-text text-transparent"
          >
            PERSONAL PROJECTS
          </span>
          <span className="relative bg-gradient-to-b from-text-primary via-text-primary/85 to-text-primary/60 bg-clip-text">
            PERSONAL PROJECTS
          </span>
        </span>
      </h2>
      <div aria-hidden className="h-px w-28 bg-gradient-to-r from-accent/70 via-accent/20 to-transparent" />
    </div>
  );
}
