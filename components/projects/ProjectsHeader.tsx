export function ProjectsHeader() {
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 max-w-full">
      <h2
        className="font-heading font-black uppercase text-center leading-[0.88] tracking-[-0.055em] select-none text-balance
                   text-[2rem] sm:text-[3.2rem] lg:text-[4.6rem] xl:text-[5.4rem] max-w-full break-words"
        aria-label="Personal Projects"
      >
        <span
          className="relative inline-block text-transparent max-w-full"
          style={{ WebkitTextStroke: "1px color-mix(in oklab, var(--border-strong) 85%, transparent)" }}
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-text-primary/[0.08] via-text-primary/[0.04] to-transparent bg-clip-text text-transparent"
          >
            PERSONAL PROJECTS
          </span>
          <span className="relative bg-gradient-to-b from-text-primary via-text-primary to-text-primary/70 bg-clip-text">
            PERSONAL PROJECTS
          </span>
        </span>
      </h2>    
    </div>
  );
}
