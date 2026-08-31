import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/Data/projects";

type Props = {
  project: Project;
  featured?: boolean;
};

export function ProjectCard({ project, featured = false }: Props) {
  return (
    <Link
      href={project.href}
      aria-label={`${project.title} — ${project.category}`}
      className="group relative flex min-w-0 shrink-0 flex-col bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary w-[min(88vw,340px)] sm:w-[420px] lg:w-[520px]"
    >
      {/* frameless media - no border, no chrome, just image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px] bg-bg-primary">
        <Image
          src={project.image}
          alt={project.title}
          fill
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 42vw, 520px"
          className="object-cover will-change-transform transition-transform duration-700 ease-[0.22,1,0.36,1] group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
          priority={featured}
        />
        {/* soft vignette only - no frame */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />

        {/* minimal top badge */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge
            variant="default"
            className="bg-bg-surface/85 backdrop-blur-md border-0 text-[11px] px-2.5 py-1 shadow-none"
          >
            {project.category}
          </Badge>
          {featured && (
            <Badge variant="accent" className="hidden sm:inline-flex text-[10px] px-2 py-1 border-0">
              Featured
            </Badge>
          )}
        </div>

        {/* frameless hover hint - reveals without boxed chrome */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-bg-surface/95 backdrop-blur-md px-3 py-1.5 font-heading text-xs text-text-primary">
            View case study <ArrowUpRight className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* editorial footer - transparent, no box */}
      <div className="flex flex-col gap-1.5 px-1 pt-4 pb-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading font-semibold text-[16px] leading-tight text-text-primary group-hover:text-accent transition-colors line-clamp-1">
            {project.title}
          </h3>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 font-heading text-[11px] uppercase tracking-wide text-text-muted group-hover:text-accent transition-colors" aria-hidden="true">
            {project.year ?? ""} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
        {project.description && (
          <p className="font-body text-[13px] leading-relaxed text-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {project.stack?.slice(0, 3).map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-pill bg-bg-surface border border-border/60 px-2.5 py-1 font-body text-[11px] leading-none text-text-secondary"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
