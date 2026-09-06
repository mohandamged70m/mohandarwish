"use client";

import { ArrowUpRight, GitFork, Star } from "lucide-react";
import type { DeveloperRepo } from "@/hooks/useDeveloperRepos";

type Props = {
  repo: DeveloperRepo;
};

export function DeveloperCard({ repo }: Props) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${repo.name} — GitHub repository`}
      className="group relative flex min-w-0 shrink-0 flex-col rounded-[16px] md:rounded-[20px] border border-border bg-bg-surface p-5 sm:p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary w-[min(82vw,360px)] sm:w-[420px] md:w-[440px] lg:w-[520px] xl:w-[560px] hover:border-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Developer · GitHub
          </p>
          <h3 className="mt-1 font-heading font-semibold text-[16px] leading-tight text-text-primary group-hover:text-accent transition-colors truncate">
            {repo.name}
          </h3>
        </div>
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-bg-primary border border-border px-2.5 py-1 font-heading text-[11px] text-text-muted group-hover:text-accent group-hover:border-accent transition-colors"
        >
          Open <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>

      {repo.description && (
        <p className="mt-2 font-body text-[13px] leading-relaxed text-text-secondary line-clamp-2 min-h-[2.6em]">
          {repo.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {repo.language && (
          <span className="inline-flex items-center rounded-pill bg-bg-primary border border-border/60 px-2.5 py-1 font-body text-[11px] leading-none text-text-secondary">
            {repo.language}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-pill bg-bg-primary border border-border/60 px-2.5 py-1 font-body text-[11px] leading-none text-text-secondary">
          <Star className="h-3 w-3" aria-hidden="true" /> {repo.stars}
        </span>
        {repo.forks > 0 && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-bg-primary border border-border/60 px-2.5 py-1 font-body text-[11px] leading-none text-text-secondary">
            <GitFork className="h-3 w-3" aria-hidden="true" /> {repo.forks}
          </span>
        )}
      </div>
    </a>
  );
}
